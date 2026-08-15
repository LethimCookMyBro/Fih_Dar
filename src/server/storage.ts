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

export interface StoredReportImage {
  relativePath: string;
  contentType: ReportImageContentType;
  size: number;
}

export interface ReadReportImage {
  data: Buffer;
  contentType: ReportImageContentType;
}

export class StorageValidationError extends Error {}

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

  const relativePath = `reports/${randomUUID()}.${extensionFor(detectedType)}`;
  const absolutePath = resolveStoredPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.data, { flag: 'wx' });

  return { relativePath, contentType: detectedType, size: input.data.byteLength };
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
