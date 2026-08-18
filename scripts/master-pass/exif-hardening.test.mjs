// Malformed-image / EXIF-parser hardening — regression tests against the
// REAL, unmodified src/server/storage.ts (via alias-loader.mjs). Untrusted
// binary input must never crash the parser or the report pipeline, missing
// EXIF must stay normal, and EXIF must never be able to look like ground
// truth. See scripts/master-pass/officer-workflow.test.mjs for the loader
// mechanism explanation.
//
//   npm run masterpass:exif-test

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { parseExif, storeReportImage, MAX_REPORT_IMAGE_BYTES } = await import(
  '../../src/server/storage.ts'
);

let passed = 0;
let failed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok — ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${error.message}`);
    console.error(`  FAIL — ${name}\n    ${error.stack?.split('\n').slice(0, 3).join('\n    ')}`);
  }
}

function bytes(...values) {
  return new Uint8Array(values);
}

function u16be(n) {
  return [(n >> 8) & 0xff, n & 0xff];
}

// A real, structurally valid minimal JPEG with NO EXIF at all: SOI, a JFIF
// APP0 segment, SOS marker, EOI. Content past SOS is not scanned by parseExif
// (it treats 0xDA as end-of-headers) so garbage scan data is fine here.
const VALID_JPEG_NO_EXIF = bytes(
  0xff, 0xd8, // SOI
  0xff, 0xe0, ...u16be(16), // APP0, length 16
  0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
  0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xda, 0x00, 0x02, 0x00, // SOS (minimal)
  0xff, 0xd9 // EOI
);

// SOI + APP1 EXIF marker whose declared length runs past the actual buffer.
function truncatedJpegWithExifTag() {
  return bytes(0xff, 0xd8, 0xff, 0xe1, ...u16be(500)); // claims 500 bytes, buffer ends here
}

// SOI + APP1 with a length that fits, but the 6-byte "Exif\0\0" signature is garbage.
function malformedExifHeader() {
  const body = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x00, 0x00]; // not "Exif\0\0"
  return bytes(0xff, 0xd8, 0xff, 0xe1, ...u16be(2 + body.length), ...body);
}

// Valid "Exif\0\0" + TIFF header, but the first-IFD offset points far outside the buffer.
function invalidIfdOffset() {
  const tiff = [
    0x49, 0x49, // "II" little-endian
    0x2a, 0x00, // magic 42
    0xff, 0xff, 0xff, 0x7f // IFD offset ~2GB — nowhere near this buffer
  ];
  const body = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0" + tiff
  return bytes(0xff, 0xd8, 0xff, 0xe1, ...u16be(2 + body.length), ...body);
}

// Valid EXIF IFD with one entry (TAG_GPS_IFD, 0x8825) whose value offset
// points far outside the buffer.
function gpsOffsetOutsideBuffer() {
  const ifdOffset = 8; // right after the 8-byte TIFF header
  const numEntries = 1;
  const tag = 0x8825; // TAG_GPS_IFD
  const type = 4; // LONG
  const count = 1;
  const valueOffset = 0x7fffffff; // absurd — outside any real buffer
  const entry = [...u16le(tag), ...u16le(type), ...u32le(count), ...u32le(valueOffset)];
  const ifd = [...u16le(numEntries), ...entry, 0, 0, 0, 0]; // + next-IFD offset (0)
  const tiff = [0x49, 0x49, 0x2a, 0x00, ...u32le(ifdOffset), ...ifd];
  const body = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  return bytes(0xff, 0xd8, 0xff, 0xe1, ...u16be(2 + body.length), ...body);
}

function u16le(n) {
  return [n & 0xff, (n >> 8) & 0xff];
}
function u32le(n) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

// Valid TIFF/IFD structure but a nonsense `type` field (250 — not any real
// EXIF type 1-10) on its one entry.
function corruptExifEntryType() {
  const ifdOffset = 8;
  const numEntries = 1;
  const entry = [...u16le(0x0110 /* TAG_MODEL */), ...u16le(250), ...u32le(1), ...u32le(0)];
  const ifd = [...u16le(numEntries), ...entry, 0, 0, 0, 0];
  const tiff = [0x49, 0x49, 0x2a, 0x00, ...u32le(ifdOffset), ...ifd];
  const body = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  return bytes(0xff, 0xd8, 0xff, 0xe1, ...u16be(2 + body.length), ...body);
}

console.log('parseExif — malformed/adversarial input never throws');

await check('valid JPEG with no EXIF -> hasExif false (not just "is a JPEG")', () => {
  const result = parseExif(VALID_JPEG_NO_EXIF);
  assert.equal(result.hasExif, false, 'hasExif must reflect an actual EXIF block, not merely a JPEG SOI');
  assert.equal(result.gpsLatitude, undefined);
  assert.equal(result.dateTimeOriginal, undefined);
});

await check('empty buffer does not throw', () => {
  const result = parseExif(new Uint8Array(0));
  assert.equal(result.hasExif, false);
});

await check('non-JPEG magic bytes (fake JPEG) does not throw', () => {
  const result = parseExif(bytes(0x50, 0x4b, 0x03, 0x04, 0x00, 0x00)); // a ZIP signature, not a JPEG
  assert.equal(result.hasExif, false);
});

await check('truncated JPEG (bare SOI, nothing else) does not throw', () => {
  const result = parseExif(bytes(0xff, 0xd8, 0xff));
  assert.equal(result.hasExif, false);
});

await check('APP1 segment claiming a length past the buffer end does not throw', () => {
  const result = parseExif(truncatedJpegWithExifTag());
  assert.equal(result.hasExif, false);
});

await check('malformed "Exif\\0\\0" signature does not throw and stays hasExif:false', () => {
  const result = parseExif(malformedExifHeader());
  assert.equal(result.hasExif, false);
});

await check('IFD offset far outside the buffer does not throw', () => {
  const result = parseExif(invalidIfdOffset());
  assert.equal(result.hasExif, false, 'TIFF header alone (no readable IFD) is not a confirmed EXIF block');
});

await check('GPS sub-IFD offset far outside the buffer does not throw and yields no GPS fields', () => {
  const result = parseExif(gpsOffsetOutsideBuffer());
  assert.equal(result.gpsLatitude, undefined, 'a bogus GPS offset must never produce a fabricated coordinate');
  assert.equal(result.gpsLongitude, undefined);
});

await check('corrupt/unknown EXIF entry type does not throw', () => {
  const result = parseExif(corruptExifEntryType());
  assert.equal(result.model, undefined, 'an unreadable field must stay absent, never garbage-populated');
});

await check('all of the above run 50x back-to-back with no accumulated crash or hang', () => {
  const inputs = [
    VALID_JPEG_NO_EXIF,
    truncatedJpegWithExifTag(),
    malformedExifHeader(),
    invalidIfdOffset(),
    gpsOffsetOutsideBuffer(),
    corruptExifEntryType(),
    new Uint8Array(0),
    bytes(0x00, 0x01, 0x02)
  ];
  for (let i = 0; i < 50; i += 1) {
    for (const input of inputs) parseExif(input);
  }
});

console.log('storeReportImage — full pipeline (try/catch integration + size guard)');

await check('oversized upload is rejected before any EXIF parsing or disk write', async () => {
  const oversized = new Uint8Array(MAX_REPORT_IMAGE_BYTES + 1);
  oversized.set([0xff, 0xd8, 0xff]);
  await assert.rejects(
    () => storeReportImage({ data: oversized, contentType: 'image/jpeg' }),
    (error) => error?.constructor?.name === 'StorageValidationError'
  );
});

await check(
  'a real end-to-end store of a malformed-EXIF JPEG succeeds with UNKNOWN provenance, never crashes the request',
  async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'fihdar-exif-test-'));
    const previous = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = tmp;
    try {
      const stored = await storeReportImage({ data: invalidIfdOffset(), contentType: 'image/jpeg' });
      assert.equal(stored.metadata.hasExif, false);
      assert.equal(stored.provenance, 'UNKNOWN', 'malformed/absent EXIF must resolve to UNKNOWN, never a confident guess');
      assert.ok(stored.relativePath.startsWith('reports/'));
    } finally {
      process.env.UPLOAD_DIR = previous;
      await rm(tmp, { recursive: true, force: true });
    }
  }
);

await check('a valid JPEG with genuinely no EXIF also resolves to UNKNOWN provenance (not a false "forwarded" claim)', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fihdar-exif-test-'));
  const previous = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = tmp;
  try {
    const stored = await storeReportImage({ data: VALID_JPEG_NO_EXIF, contentType: 'image/jpeg' });
    assert.equal(stored.metadata.hasExif, false);
    assert.equal(
      stored.provenance,
      'UNKNOWN',
      'missing EXIF alone must never be reported as FORWARDED_OR_EXTERNAL — that would be false confidence from absence of evidence'
    );
  } finally {
    process.env.UPLOAD_DIR = previous;
    await rm(tmp, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
}
