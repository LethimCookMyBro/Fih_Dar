import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

export const MAX_REPORT_IMAGE_BYTES = 5 * 1024 * 1024;

export const REPORT_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
} as const;

export type ReportImageContentType = keyof typeof REPORT_IMAGE_TYPES;

export type ImageProvenance =
  | 'CAPTURED_IN_FIHDAR'
  | 'ORIGINAL_UPLOAD'
  | 'DERIVED_OR_SCREENSHOT'
  | 'FORWARDED_OR_EXTERNAL'
  | 'UNKNOWN';

export interface ImageMetadata {
  // EXIF GPS (if present)
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  gpsTimestamp?: string;
  // EXIF timestamps
  dateTimeOriginal?: string;
  dateTimeDigitized?: string;
  dateTime?: string;
  // Image properties
  width?: number;
  height?: number;
  orientation?: number;
  // Camera info
  make?: string;
  model?: string;
  software?: string;
  // Raw EXIF presence
  hasExif: boolean;
  // Provenance hints
  provenanceHints?: {
    isScreenshot?: boolean;
    hasSocialMediaStripping?: boolean;
    forwardedIndicators?: string[];
  };
}

export interface StoredReportImage {
  relativePath: string;
  contentType: ReportImageContentType;
  size: number;
  metadata: ImageMetadata;
  provenance: ImageProvenance;
}

export interface ReadReportImage {
  data: Buffer;
  contentType: ReportImageContentType;
}

export class StorageValidationError extends Error {}

export function parseExif(data: Uint8Array): ImageMetadata {
  const result: ImageMetadata = { hasExif: false };

  // Only parse JPEG for EXIF (most common format with EXIF)
  if (data.length < 3 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
    return result;
  }

  // hasExif is set inside parseExifBlock, only once a genuine "Exif\0\0" +
  // valid TIFF header is confirmed — being a JPEG at all is not evidence of
  // EXIF presence (most images have none), and detectProvenance()/officers
  // reading imageMetadata rely on this field meaning what it says.
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;
  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) break;
    const marker = data[offset + 1];
    offset += 2;

    // APP1 marker (0xE1) typically contains EXIF
    if (marker === 0xe1) {
      if (offset + 2 > data.length) break;
      const length = view.getUint16(offset, false);
      if (offset + length > data.length) break;

      const exifData = data.slice(offset, offset + length);
      parseExifBlock(exifData, result);

      offset += length - 2;
    } else if (marker >= 0xe0 && marker <= 0xef) {
      // Other APP markers - skip
      if (offset + 2 > data.length) break;
      const length = view.getUint16(offset, false);
      offset += length - 2;
    } else if (marker === 0xda) {
      // Start of scan - end of headers
      break;
    } else if (marker === 0xd9) {
      // End of image
      break;
    } else {
      // Standalone markers (0x01, 0xd0-0xd7, 0xd9)
      if (marker < 0xd0 || marker > 0xd9) {
        if (offset + 2 > data.length) break;
        const length = view.getUint16(offset, false);
        offset += length - 2;
      }
    }
  }

  return result;
}

function parseExifBlock(exifData: Uint8Array, result: ImageMetadata): void {
  // EXIF header: "Exif\0\0" (6 bytes) + TIFF header
  if (exifData.length < 8) return;
  const header = new TextDecoder().decode(exifData.slice(0, 6));
  if (header !== 'Exif\0\0') return;

  // TIFF header starts at offset 6
  let tiffOffset = 6;
  if (exifData.length < tiffOffset + 8) return;

  const view = new DataView(exifData.buffer, exifData.byteOffset, exifData.byteLength);
  // Byte order: II (little-endian) or MM (big-endian)
  const isLE = view.getUint16(tiffOffset, true) === 0x4949;

  // Magic number (42)
  const magic = view.getUint16(tiffOffset + 2, isLE);
  if (magic !== 0x002a) return;

  // A structurally genuine EXIF block is now confirmed.
  result.hasExif = true;

  // First IFD offset
  const ifdOffset = view.getUint32(tiffOffset + 4, isLE);
  if (tiffOffset + ifdOffset + 2 > exifData.length) return;

  parseIfd(exifData, tiffOffset + ifdOffset, tiffOffset, isLE, result);
}

function parseIfd(
  data: Uint8Array,
  ifdOffset: number,
  baseOffset: number,
  isLE: boolean,
  result: ImageMetadata
): void {
  if (ifdOffset + 2 > data.length) return;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numEntries = view.getUint16(ifdOffset, isLE);

  let entryOffset = ifdOffset + 2;
  for (let i = 0; i < numEntries; i++) {
    if (entryOffset + 12 > data.length) break;

    const tag = view.getUint16(entryOffset, isLE);
    const type = view.getUint16(entryOffset + 2, isLE);
    const count = view.getUint32(entryOffset + 4, isLE);
    const valueOffset = view.getUint32(entryOffset + 8, isLE);

    // Parse known EXIF tags
    parseExifTag(data, baseOffset, isLE, tag, type, count, valueOffset, result);

    entryOffset += 12;
  }

  // Next IFD offset (for chained IFDs)
  if (entryOffset + 4 <= data.length) {
    const nextIfd = view.getUint32(entryOffset, isLE);
    if (nextIfd !== 0 && baseOffset + nextIfd + 2 < data.length) {
      parseIfd(data, baseOffset + nextIfd, baseOffset, isLE, result);
    }
  }
}

function parseExifTag(
  data: Uint8Array,
  baseOffset: number,
  isLE: boolean,
  tag: number,
  type: number,
  count: number,
  valueOffset: number,
  result: ImageMetadata
): void {
  // Type sizes: 1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL, 7=UNDEFINED, 9=SLONG, 10=SRATIONAL
  const typeSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8][type] ?? 0;
  if (typeSize === 0) return;

  const tagView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const totalSize = count * typeSize;
  const isInline = totalSize <= 4;
  const offset = isInline ? valueOffset : baseOffset + valueOffset;
  if (offset + totalSize > data.length) return;

  const readString = (off: number, len: number): string => {
    const bytes = data.slice(off, off + len);
    const nullIdx = bytes.indexOf(0);
    return new TextDecoder().decode(nullIdx >= 0 ? bytes.slice(0, nullIdx) : bytes);
  };

  // EXIF tags this parser actually reads. GPS sub-IFD tags are handled
  // separately by parseGpsIfd (which matches on its own literal values) — no
  // point duplicating a GPS tag table here that nothing reads.
  const TAG_IMAGE_WIDTH = 0x0100;
  const TAG_IMAGE_HEIGHT = 0x0101;
  const TAG_MAKE = 0x010f;
  const TAG_MODEL = 0x0110;
  const TAG_ORIENTATION = 0x0112;
  const TAG_SOFTWARE = 0x0131;
  const TAG_DATETIME = 0x0132;
  const TAG_EXIF_IFD = 0x8769;
  const TAG_GPS_IFD = 0x8825;

  // Switch on tag
  switch (tag) {
    case TAG_IMAGE_WIDTH:
      if (type === 3 || type === 4) {
        result.width = tagView.getUint16(offset, isLE);
      }
      break;
    case TAG_IMAGE_HEIGHT:
      if (type === 3 || type === 4) {
        result.height = tagView.getUint16(offset, isLE);
      }
      break;
    case TAG_MAKE:
      if (type === 2) result.make = readString(offset, Math.min(totalSize, 64));
      break;
    case TAG_MODEL:
      if (type === 2) result.model = readString(offset, Math.min(totalSize, 64));
      break;
    case TAG_SOFTWARE:
      if (type === 2) result.software = readString(offset, Math.min(totalSize, 64));
      break;
    case TAG_ORIENTATION:
      if (type === 3) result.orientation = tagView.getUint16(offset, isLE);
      break;
    case TAG_DATETIME:
      if (type === 2) result.dateTime = readString(offset, 20);
      break;
    case TAG_EXIF_IFD:
      if (type === 4) {
        parseIfd(data, baseOffset + valueOffset, baseOffset, isLE, result);
      }
      break;
    case TAG_GPS_IFD:
      if (type === 4) {
        parseGpsIfd(data, baseOffset + valueOffset, baseOffset, isLE, result);
      }
      break;
  }
}

function parseGpsIfd(
  data: Uint8Array,
  ifdOffset: number,
  baseOffset: number,
  isLE: boolean,
  result: ImageMetadata
): void {
  if (ifdOffset + 2 > data.length) return;
  const gpsView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numEntries = gpsView.getUint16(ifdOffset, isLE);

  const readStringAt = (off: number, len: number): string => {
    const bytes = data.slice(off, off + len);
    const nullIdx = bytes.indexOf(0);
    return new TextDecoder().decode(nullIdx >= 0 ? bytes.slice(0, nullIdx) : bytes);
  };

  let entryOffset = ifdOffset + 2;
  let latRef: string | null = null;
  let lat: number[] = [];
  let lonRef: string | null = null;
  let lon: number[] = [];
  let altRef = 0;
  let alt = 0;
  let gpsTime: string | null = null;

  for (let i = 0; i < numEntries; i++) {
    if (entryOffset + 12 > data.length) break;

    const tag = gpsView.getUint16(entryOffset, isLE);
    const type = gpsView.getUint16(entryOffset + 2, isLE);
    const count = gpsView.getUint32(entryOffset + 4, isLE);
    const valueOffset = gpsView.getUint32(entryOffset + 8, isLE);

    const totalSize = count * (type === 5 ? 8 : type === 2 ? 1 : 0); // Simplified
    const isInline = totalSize <= 4;
    const offset = isInline ? valueOffset : baseOffset + valueOffset;
    if (offset + totalSize > data.length) {
      entryOffset += 12;
      continue;
    }

    const readRational = (off: number): number => {
      const num = gpsView.getUint32(off, isLE);
      const den = gpsView.getUint32(off + 4, isLE);
      return den !== 0 ? num / den : 0;
    };

    // GPS tags
    switch (tag) {
      case 0x0001: // GPSLatitudeRef
        if (type === 2) latRef = readStringAt(offset, 2);
        break;
      case 0x0002: // GPSLatitude
        if (type === 5 && count >= 3) {
          lat = [readRational(offset), readRational(offset + 8), readRational(offset + 16)];
        }
        break;
      case 0x0003: // GPSLongitudeRef
        if (type === 2) lonRef = readStringAt(offset, 2);
        break;
      case 0x0004: // GPSLongitude
        if (type === 5 && count >= 3) {
          lon = [readRational(offset), readRational(offset + 8), readRational(offset + 16)];
        }
        break;
      case 0x0005: // GPSAltitudeRef
        if (type === 1) altRef = data[offset];
        break;
      case 0x0006: // GPSAltitude
        if (type === 5) alt = readRational(offset);
        break;
      case 0x0007: // GPSTimeStamp
        if (type === 5 && count >= 3) {
          gpsTime = `${readRational(offset)}:${readRational(offset + 8)}:${readRational(offset + 16)}`;
        }
        break;
    }

    entryOffset += 12;
  }

  // Convert DMS to decimal
  if (lat.length === 3 && lon.length === 3 && latRef && lonRef) {
    const latDeg = lat[0] + lat[1] / 60 + lat[2] / 3600;
    const lonDeg = lon[0] + lon[1] / 60 + lon[2] / 3600;
    result.gpsLatitude = latRef === 'S' ? -latDeg : latDeg;
    result.gpsLongitude = lonRef === 'W' ? -lonDeg : lonDeg;
  }
  if (alt !== 0) {
    result.gpsAltitude = altRef === 1 ? -alt : alt;
  }
  if (gpsTime) result.gpsTimestamp = gpsTime;
}

function uploadDirectory(): string {
  // The upload root is resolved at runtime from an env var or cwd. The
  // turbopackIgnore hints stop the build tracer from concluding that the whole
  // project is a runtime dependency of this route.
  const configured = process.env.UPLOAD_DIR;
  if (configured) return resolve(/*turbopackIgnore: true*/ configured);
  return join(/*turbopackIgnore: true*/ process.cwd(), '.data', 'uploads');
}

function normalizeContentType(value: string): ReportImageContentType {
  const normalized = value.toLowerCase().split(';', 1)[0].trim();
  if (normalized in REPORT_IMAGE_TYPES) return normalized as ReportImageContentType;
  throw new StorageValidationError('Unsupported image content type');
}

function detectContentType(data: Uint8Array): ReportImageContentType {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return 'image/webp';
  }
  throw new StorageValidationError('Image magic bytes are invalid');
}

function resolveStoredPath(relativePath: string): string {
  const root = uploadDirectory();
  const normalized = relativePath.replaceAll('\\', '/');
  if (!/^reports\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(normalized)) {
    throw new StorageValidationError('Invalid stored image path');
  }

  const absolutePath = resolve(root, normalized);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    throw new StorageValidationError('Invalid stored image path');
  }
  return absolutePath;
}

function extensionFor(contentType: ReportImageContentType): string {
  return REPORT_IMAGE_TYPES[contentType];
}

export async function storeReportImage(input: {
  data: Uint8Array;
  contentType: string;
}): Promise<StoredReportImage> {
  if (input.data.byteLength === 0 || input.data.byteLength > MAX_REPORT_IMAGE_BYTES) {
    throw new StorageValidationError('Image exceeds the maximum allowed size');
  }

  const declaredType = normalizeContentType(input.contentType);
  const detectedType = detectContentType(input.data);
  if (declaredType !== detectedType) {
    throw new StorageValidationError('Image content type does not match its bytes');
  }

  // Extract EXIF metadata. Untrusted binary input: a parser bug must never
  // fail the whole report submission — fall back to "no metadata available"
  // rather than propagate an exception (see parseExif's own bounds checks;
  // this catch is defense-in-depth for whatever those checks miss).
  let metadata: ImageMetadata;
  try {
    metadata = parseExif(input.data);
  } catch {
    metadata = { hasExif: false };
  }

  // Detect provenance
  const provenance = detectProvenance(metadata);

  const relativePath = `reports/${randomUUID()}.${extensionFor(detectedType)}`;
  const absolutePath = resolveStoredPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.data, { flag: 'wx' });

  return {
    relativePath,
    contentType: detectedType,
    size: input.data.byteLength,
    metadata,
    provenance
  };
}

function detectProvenance(metadata: ImageMetadata): ImageProvenance {
  // Check for screenshot indicators
  if (metadata.provenanceHints?.isScreenshot) {
    return 'DERIVED_OR_SCREENSHOT';
  }

  // Missing EXIF is common and normal (many phone camera apps and privacy
  // modes strip it, and CAPTURED_IN_FIHDAR uploads may never have had EXIF
  // to begin with) — it is NOT, by itself, evidence of external/forwarded
  // origin. Only an explicit signal below (a declared social-media Software
  // tag, or dimensions matching a common screenshot size) upgrades away from
  // UNKNOWN; absence of EXIF alone must not.

  // Check software field for social media indicators
  if (metadata.software) {
    const sw = metadata.software.toLowerCase();
    if (
      sw.includes('instagram') ||
      sw.includes('facebook') ||
      sw.includes('line') ||
      sw.includes('whatsapp') ||
      sw.includes('twitter') ||
      sw.includes('tiktok') ||
      sw.includes('screenshot') ||
      sw.includes('edited')
    ) {
      return 'FORWARDED_OR_EXTERNAL';
    }
  }

  // Check dimensions - screenshots often have specific aspect ratios or sizes
  if (metadata.width && metadata.height) {
    // Very common screenshot dimensions (mobile screens)
    const commonScreenshotDims = [
      '1080x1920',
      '1920x1080',
      '1170x2532',
      '2532x1170',
      '1242x2688',
      '2688x1242',
      '828x1792',
      '1792x828',
      '750x1334',
      '1334x750',
      '640x1136',
      '1136x640'
    ];
    const dimKey = `${metadata.width}x${metadata.height}`;
    if (commonScreenshotDims.includes(dimKey)) {
      // Could be screenshot, but not definitive
      metadata.provenanceHints = {
        ...metadata.provenanceHints,
        isScreenshot: true
      };
    }
  }

  // If the image has intact EXIF with camera make/model, likely original
  if (metadata.hasExif && (metadata.make || metadata.model)) {
    return 'ORIGINAL_UPLOAD';
  }

  // Default to UNKNOWN - we can't determine
  return 'UNKNOWN';
}

export async function readReportImage(relativePath: string): Promise<ReadReportImage> {
  const absolutePath = resolveStoredPath(relativePath);
  const data = await readFile(absolutePath);
  if (data.byteLength > MAX_REPORT_IMAGE_BYTES) {
    throw new StorageValidationError('Stored image exceeds the maximum allowed size');
  }

  const detectedType = detectContentType(data);
  if (extname(relativePath).slice(1) !== extensionFor(detectedType)) {
    throw new StorageValidationError('Stored image extension does not match its bytes');
  }
  return { data, contentType: detectedType };
}

export async function deleteReportImage(relativePath: string): Promise<void> {
  await unlink(resolveStoredPath(relativePath)).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  });
}

export async function listStoredReportImages(): Promise<string[]> {
  const directory = join(uploadDirectory(), 'reports');
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  });
  return entries
    .filter((entry) => entry.isFile() && /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(entry.name))
    .map((entry) => relative(uploadDirectory(), join(directory, entry.name)).replaceAll(sep, '/'));
}
