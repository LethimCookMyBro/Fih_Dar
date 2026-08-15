// Event candidate resolution.
//
// Several observations (news article, official publication, …) may reference
// the same real-world event. This module groups RELEVANT observations into
// EventCandidate rows using explainable agreement dimensions:
//   - location agreement (same normalized province)
//   - time proximity (≤ EVENT_WINDOW_DAYS when both dates exist)
//   - semantic similarity OR fuzzy text ratio
//   - species match (implicit — all members passed the species gate)
//
// Grouping NEVER verifies anything: candidates stay status EXPERIMENTAL and
// the member roles + pairwise scores are preserved in evidence.

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

import { normalizeText } from './normalize.mjs';
import { cosineSimilarity } from './embed.mjs';
import { minhashFor } from './dedupe.mjs';

const require = createRequire(import.meta.url);
const fuzzball = require('fuzzball');

const EVENT_WINDOW_DAYS = 21;
const CLUSTER_SPAN_DAYS = 14;
const SEMANTIC_SIMILARITY = 0.75;
const FUZZY_RATIO = 90;
const MIN_JACCARD = 0.3; // distinct stories share few bigrams; rewrites share many

function dayDifference(a, b) {
  if (!a || !b) return 0;
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return ms / 86_400_000;
}

/**
 * Build EventCandidate groupings for the given RELEVANT observations.
 * Returns an array of { slug, members: [...], evidence } ready to persist.
 */
export function resolveEvents(observations, vectorsByObservation) {
  const n = observations.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const indexById = new Map(observations.map((o, i) => [o.id, i]));
  const signatures = observations.map((o) => minhashFor(o.title, o.description));
  const pairwise = [];

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = observations[i];
      const b = observations[j];
      if (a.sourceExternalId === b.sourceExternalId) continue; // same item
      if (a.normalizedProvince && b.normalizedProvince && a.normalizedProvince !== b.normalizedProvince) {
        continue; // location disagreement
      }
      if (dayDifference(a.publishedAt, b.publishedAt) > EVENT_WINDOW_DAYS) continue; // time disagreement
      const semantic = vectorsByObservation && vectorsByObservation.get(a.id) && vectorsByObservation.get(b.id)
        ? cosineSimilarity(vectorsByObservation.get(a.id), vectorsByObservation.get(b.id))
        : null;
      const fuzzy = fuzzball.token_set_ratio(
        normalizeText(`${a.title} ${a.description ?? ''}`),
        normalizeText(`${b.title} ${b.description ?? ''}`)
      );
      const jaccardScore = signatures[i].jaccard(signatures[j]);
      const semanticOk = semantic !== null && semantic >= SEMANTIC_SIMILARITY;
      const fuzzyOk = fuzzy >= FUZZY_RATIO;
      // A story-level match needs lexical overlap too — high semantic
      // similarity alone (same species + same province vocabulary) is not
      // enough to call two articles the same event.
      if (jaccardScore < MIN_JACCARD) continue;
      if (!semanticOk && !fuzzyOk) continue;
      pairwise.push({
        a: a.id,
        b: b.id,
        semantic: semantic === null ? null : Math.round(semantic * 1000) / 1000,
        fuzzy: Math.round(fuzzy),
        jaccard: Math.round(jaccardScore * 1000) / 1000
      });
      union(i, j);
    }
  }

  // Group by root, then split each component by time coherence so similarity
  // chaining cannot collapse months of coverage into one mega-group.
  const groups = new Map();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  const clusters = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue; // singletons are not "events"
    const rows = members.map((index) => observations[index]);
    clusters.push(...splitByTimeCoherence(rows));
  }

  const candidates = [];
  for (const rows of clusters) {
    if (rows.length < 2) continue;
    const slug = requireSlug(rows);
    const kindCounts = {};
    for (const row of rows) {
      kindCounts[row.relevanceKind ?? 'UNRELATED'] = (kindCounts[row.relevanceKind ?? 'UNRELATED'] ?? 0) + 1;
    }
    const kind = Object.entries(kindCounts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'RELATED';
    const eventDate = rows
      .map((row) => row.publishedAt)
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const province = rows.find((row) => row.normalizedProvince)?.normalizedProvince ?? null;
    candidates.push({
      slug,
      status: 'EXPERIMENTAL',
      kind: kind === 'SIGHTING' ? 'possible-sighting' : 'related-event',
      province,
      eventDate,
      members: rows.map((row) => ({ id: row.id, title: row.title, source: row.sourceName, publishedAt: row.publishedAt })),
      evidence: {
        algorithm: 'union-find over location+time+semantic/fuzzy agreement',
        windowDays: EVENT_WINDOW_DAYS,
        pairwise
      }
    });
  }
  return candidates;
}

function requireSlug(rows) {
  const ids = rows.map((row) => row.id).sort().join('|');
  return createHash('sha1').update(ids).digest('hex');
}

/**
 * Split a union-find component into sub-clusters whose dated span fits within
 * CLUSTER_SPAN_DAYS. Undated rows join the nearest dated cluster (or the first
 * when no dates exist). Prevents transitive similarity from chaining distinct
 * events (e.g. months of "Pattaya beach" coverage) into one giant candidate.
 */
function splitByTimeCoherence(rows) {
  const dated = rows
    .filter((row) => row.publishedAt)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  const undated = rows.filter((row) => !row.publishedAt);
  const clusters = [];
  for (const row of dated) {
    // Hard span bound: a row joins a cluster only while it is within
    // CLUSTER_SPAN_DAYS of that cluster's START — prevents a rolling window
    // from chaining coverage across months.
    const open = clusters.find((cluster) => {
      return new Date(row.publishedAt).getTime() - cluster.start <= CLUSTER_SPAN_DAYS * 86_400_000;
    });
    if (open) {
      open.rows.push(row);
    } else {
      clusters.push({ rows: [row], start: new Date(row.publishedAt).getTime() });
    }
  }
  if (undated.length > 0) {
    if (clusters.length === 0) {
      clusters.push({ rows: [], start: 0 });
    }
    // attach undated rows to the closest dated cluster by date proximity
    for (const row of undated) {
      let best = clusters[0];
      let bestDistance = Infinity;
      for (const cluster of clusters) {
        const distance = Math.min(
          Math.abs(new Date(row.scrapedAt ?? 0).getTime() - cluster.rows[0].publishedAt.getTime()),
          Math.abs(new Date(row.scrapedAt ?? 0).getTime() - new Date(cluster.rows[cluster.rows.length - 1].publishedAt).getTime())
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          best = cluster;
        }
      }
      best.rows.push(row);
    }
  }
  return clusters.map((cluster) => cluster.rows);
}
