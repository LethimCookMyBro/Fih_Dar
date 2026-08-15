// Duplicate and near-duplicate detection.
//
// Layers, weakest to strongest:
//   1. Exact source dedupe — already enforced by the (sourceName,
//      sourceExternalId) unique constraint at ingest time.
//   2. Canonical URL — strips Google News tracking parameters so the same
//      underlying article keeps one identity.
//   3. Content hash — sha256 of normalized title+description.
//   4. MinHash + banded LSH (datasketch-style, via the `minhash` package) over
//      char-bigram shingles, verified with a fuzzy ratio.
//
// Nothing is ever deleted or overwritten: the later row simply records
// `duplicateOfId` pointing at the canonical (earliest) row, with the measured
// similarities preserved in evidence.

import { createRequire } from 'node:module';

import { Minhash, LshIndex } from 'minhash';

import { charBigrams, normalizeText, sha256Hex } from './normalize.mjs';

const require = createRequire(import.meta.url);
const fuzzball = require('fuzzball');

const NUM_PERM = 128;
const BAND_SIZE = 8;
const FUZZY_CONFIRM = 88;

export function canonicalSourceUrl(sourceUrl) {
  if (!sourceUrl) return '';
  let url = sourceUrl;
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.includes('news.google.com')) {
      parsed.search = ''; // strip ?oc=5 &co=… tracking noise
    }
    url = parsed.href;
  } catch {
    // leave as-is
  }
  return url.replace(/\/+$/, '');
}

export function contentHash(title, description) {
  return sha256Hex(normalizeText(`${title ?? ''} ${description ?? ''}`));
}

export function minhashFor(title, description) {
  const grams = charBigrams(`${title ?? ''} ${description ?? ''}`);
  const hash = new Minhash({ numPerm: NUM_PERM, seed: 42 });
  for (const gram of grams) hash.update(gram);
  return hash;
}

/**
 * Given the full ordered list of observations, returns a Map<id, {duplicateOfId,
 * evidence}> marking each row that is a near-duplicate of an earlier canonical
 * row. The earliest row in a duplicate group is the canonical one.
 */
export function findNearDuplicates(observations) {
  const byContentHash = new Map();
  const lsh = new LshIndex({ bandSize: BAND_SIZE });
  const signatures = new Map();

  for (const observation of observations) {
    const key = contentHash(observation.title, observation.description);
    if (byContentHash.has(key)) {
      // Exact content duplicate (e.g. same article re-published under a new
      // Google News id). Record immediately against the earliest row.
      continue;
    }
    const signature = minhashFor(observation.title, observation.description);
    byContentHash.set(key, observation);
    signatures.set(observation.id, signature);
    lsh.insert(observation.id, signature);
  }

  const result = new Map();
  for (const observation of observations) {
    const key = contentHash(observation.title, observation.description);
    const canonical = byContentHash.get(key);
    if (canonical && canonical.id !== observation.id) {
      result.set(observation.id, {
        duplicateOfId: canonical.id,
        evidence: {
          method: 'content-hash',
          score: 1,
          canonicalUrl: canonicalSourceUrl(canonical.sourceUrl)
        }
      });
      continue;
    }
  }

  // Near-duplicate pass via LSH candidates.
  const candidates = new Map();
  for (const observation of observations) {
    const signature = signatures.get(observation.id);
    if (!signature) continue;
    const matches = lsh.query(signature);
    for (const matchId of matches) {
      if (matchId === observation.id) continue;
      const pairKey = [observation.id, matchId].sort().join('|');
      if (candidates.has(pairKey)) continue;
      candidates.set(pairKey, { a: observation, b: matchId });
    }
  }

  const orderIndex = new Map(observations.map((o, i) => [o.id, i]));
  for (const { a, b } of candidates.values()) {
    const bObs = observations.find((o) => o.id === b);
    if (!bObs) continue;
    const ratio = fuzzball.token_set_ratio(
      normalizeText(`${a.title} ${a.description ?? ''}`),
      normalizeText(`${bObs.title} ${bObs.description ?? ''}`)
    );
    if (ratio < FUZZY_CONFIRM) continue;
    // Later row points at the earlier row (canonical).
    const later = orderIndex.get(a.id) > orderIndex.get(b) ? a : bObs;
    const earlier = later.id === a.id ? bObs : a;
    if (!result.has(later.id)) {
      result.set(later.id, {
        duplicateOfId: earlier.id,
        evidence: {
          method: 'minhash-lsh',
          score: Math.round(ratio),
          canonicalUrl: canonicalSourceUrl(earlier.sourceUrl)
        }
      });
    }
  }

  return result;
}
