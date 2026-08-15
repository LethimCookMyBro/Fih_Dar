// Sentence embeddings for semantic relevance scoring.
//
// Model: Xenova/multilingual-e5-small (intfloat/multilingual-e5-small exported
// to ONNX) — selected over paraphrase-multilingual-MiniLM-L12-v2 because it is
// retrieval-tuned (better for relevance than STS-tuned MiniLM), covers Thai,
// and ships a quantized ONNX export (~40 MB, 384-dim). Loads lazily; a model
// failure degrades to keyword-only relevance — it can never crash the worker
// or the web app.
//
// Cache: embeddings are cached on disk (keyed by text hash) so re-runs do not
// re-embed. Batch: the pipeline accepts arrays (see benchmark: ~3.7 ms/text
// warm).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { sha256Hex } from './normalize.mjs';

const CACHE_FILE = join(process.cwd(), '.data', 'intel', 'embedding-cache.json');
const MODEL = 'Xenova/multilingual-e5-small';
const DIM = 384;

let pipelinePromise = null;
let cache = null;

function loadCache() {
  if (cache) return cache;
  try {
    cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function saveCache() {
  try {
    mkdirSync(join(process.cwd(), '.data', 'intel'), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // cache is best-effort only
  }
}

async function getExtractor() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = join(process.cwd(), '.data', 'intel', 'models');
      return pipeline('feature-extraction', MODEL, { dtype: 'q8' });
    })();
  }
  return pipelinePromise;
}

/**
 * Embed a list of texts. Returns Float32Array[] (384-dim, L2-normalized) or
 * null when the model is unavailable. e5 requires a 'query:'/'passage:' prefix.
 */
export async function embedTexts(texts, { kind = 'passage' } = {}) {
  const store = loadCache();
  const prefix = kind === 'query' ? 'query: ' : 'passage: ';
  const uncached = [];
  const keys = [];
  for (const text of texts) {
    const clean = String(text ?? '').trim();
    const key = sha256Hex(clean);
    keys.push(key);
    if (!store[key] || store[key].length !== DIM) uncached.push({ key, text: `${prefix}${clean}` });
  }

  if (uncached.length > 0) {
    let extractor;
    try {
      extractor = await getExtractor();
    } catch (error) {
      return { vectors: null, reason: `embedding unavailable: ${error.message ?? error}` };
    }
    // Chunked inference bounds onnxruntime peak memory on CPU instances
    // (a single large batch spiked ~3.4 GB RSS in benchmarking).
    const CHUNK = 32;
    for (let offset = 0; offset < uncached.length; offset += CHUNK) {
      const chunk = uncached.slice(offset, offset + CHUNK);
      const output = await extractor(
        chunk.map((item) => item.text),
        { pooling: 'mean', normalize: true }
      );
      for (let i = 0; i < chunk.length; i += 1) {
        store[chunk[i].key] = Array.from(output.data.slice(i * DIM, (i + 1) * DIM));
      }
    }
    saveCache();
  }

  const vectors = keys.map((key) => (store[key] ? Float32Array.from(store[key]) : null));
  if (vectors.some((vector) => vector === null)) {
    return { vectors: null, reason: 'incomplete embedding cache' };
  }
  return { vectors };
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}
