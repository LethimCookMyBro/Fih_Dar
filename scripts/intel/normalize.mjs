// Text normalization for the intelligence pipeline.
//
// Deterministic, cheap, and safe on any input — this stage must never throw on
// malformed text (raw observations are preserved regardless).
import { createHash } from 'node:crypto';

/** NFKC-normalize, strip HTML, collapse whitespace, lowercase. */
export function normalizeText(value) {
  if (!value) return '';
  return String(value)
    // NFC recomposes decomposed Thai (ด + ํ + า → ดำ) instead of NFKC, which
    // would decompose the precomposed SARA AM and break Thai keyword matching.
    .normalize('NFC')
    .replace(/<[^>]*>/g, ' ') // strip HTML tags (RSS descriptions carry <a href=…>)
    .replace(/&[a-z]+;/gi, ' ') // crude entity strip; ingest already decoded most
    .replace(/[ \t\u00a0\u200b]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
    .toLocaleLowerCase('th');
}

/** sha256 hex of a string — used for content hashing and cache keys. */
export function sha256Hex(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

/**
 * Char-bigram shingles of normalized text. Language-agnostic (works for
 * unsegmented Thai) and standard practice for near-duplicate detection.
 */
export function charBigrams(value, length = 2) {
  const text = normalizeText(value).replace(/[^a-z0-9\u0e00-\u0e7f\u0e81-\u0eff ]/gi, '');
  if (text.length <= length) return text ? [text] : [];
  const grams = [];
  for (let i = 0; i <= text.length - length; i += 1) {
    grams.push(text.slice(i, i + length));
  }
  return grams;
}
