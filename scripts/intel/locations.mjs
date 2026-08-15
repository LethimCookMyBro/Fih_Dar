// Thai location extraction and normalization.
//
// Reference data: the standard jquery.Thailand.js address database (77
// provinces, ~878 amphoes) shipped by the `thai-address-database` package.
// Extraction is deterministic-first (prefix + exact name match), then
// RapidFuzz-style fuzzy normalization (fuzzball) with the match score recorded
// in evidence. A location is NEVER invented: if the text only says
// "จังหวัดชลบุรี" we store province=ชลบุรี with precision PROVINCE — no
// coordinates are derived.

import { createRequire } from 'node:module';

import { normalizeText } from './normalize.mjs';
import {
  EXPERIMENTAL_LOCATION_FUZZY_PROVINCE,
  EXPERIMENTAL_LOCATION_FUZZY_DISTRICT,
  WATERBODY_CAPTURE_MIN_LEN,
  WATERBODY_CAPTURE_MAX_LEN
} from './thresholds.mjs';

const require = createRequire(import.meta.url);
const fuzzball = require('fuzzball');
const rawDatabase = require('thai-address-database/database/db.json');

// English→Thai aliases for places likely to appear in coverage of the study
// area. Deliberately small; fuzzy matching handles the rest of the admin
// hierarchy.
const ENGLISH_ALIASES = [
  { text: 'bang pakong', district: 'บางปะกง', province: 'ฉะเชิงเทรา' },
  { text: 'chachoengsao', province: 'ฉะเชิงเทรา' },
  { text: 'chonburi', province: 'ชลบุรี' },
  { text: 'chon buri', province: 'ชลบุรี' },
  { text: 'rayong', province: 'ระยอง' },
  { text: 'samut prakan', province: 'สมุทรปราการ' },
  { text: 'si racha', district: 'ศรีราชา', province: 'ชลบุรี' },
  { text: 'sriracha', district: 'ศรีราชา', province: 'ชลบุรี' }
];

// Local EEC locality aliases — province-level mappings for places the EEC
// corpus actually uses that are NOT amphoe rows in the admin database (Pattaya
// is a special administrative city inside Chonburi). Deliberately minimal;
// โรงโป๊ะ / บางแสน remain unmapped rather than guessed.
const LOCAL_ALIASES = [
  { text: 'พัทยา', province: 'ชลบุรี' }
];

// Site qualifiers that can prefix a local alias. The FULL phrase is preserved
// as the most-specific place (หาดพัทยา > พัทยา) — the site is never collapsed
// to the bare alias, and it is never misclassified as a waterbody. Ordered
// longest-first so ชายหาด wins over หาด.
const SITE_QUALIFIERS = ['ชายหาด', 'ชายฝั่ง', 'เมือง', 'หาด', 'ทะเล'];

/** Most-specific place phrase ending at `index`, or the bare alias text. */
function placePhrase(text, index, aliasText) {
  // Window 8 covers the longest qualifier ชายฝั่ง (7 code points).
  const before = text.slice(Math.max(0, index - 8), index);
  const qualifier = SITE_QUALIFIERS.find((q) => before.endsWith(q));
  return qualifier ? qualifier + aliasText : aliasText;
}

// Candidate-ranking cues for province selection. Deliberately small and
// deterministic — not an NLP engine. A mention is *boosted* when an event cue
// directly precedes it; it is *demoted* (never deleted) for
// origin/surname/publisher/history context. Demotion only matters when more
// than one candidate exists, so a lone historical mention still resolves.
// Surnames (ณ …) are excluded entirely — a surname is never an event location.
const EVENT_CUES = [
  'ล่าสุดที่',
  'เหตุการณ์ใหม่เกิดที่',
  'ตรวจเหตุที่',
  'เกิดที่',
  'พบที่',
  'ที่หาด',
  'ที่ชายฝั่ง',
  'ชายหาด',
  'ชายฝั่ง'
];
const PUBLISHER_CUES = ['ผู้สื่อข่าว', 'สำนักข่าว'];
const HISTORY_AFTER_CUES = ['ประวัติศาสตร์', 'ในอดีต', 'เมื่อปีที่แล้ว'];
// Windows are sized for the longest cue ('เหตุการณ์ใหม่เกิดที่' ≈ 19 code
// points, 'ผู้สื่อข่าว' = 9, 'ประวัติศาสตร์' can start ~17 chars after a
// mention). endsWith / includes still pin each cue to the mention.
const EVENT_CUE_WINDOW = 24;
const PUBLISHER_CUE_WINDOW = 12;
const HISTORY_BEFORE_WINDOW = 12;
const HISTORY_AFTER_WINDOW = 20;

function hasEventCue(text, index) {
  const window = text.slice(Math.max(0, index - EVENT_CUE_WINDOW), index);
  return EVENT_CUES.some((cue) => window.endsWith(cue));
}

function isOriginMention(text, index) {
  return text.slice(Math.max(0, index - 2), index) === 'จาก';
}

function isSurnameMention(text, index) {
  // The surname particle ณ must be a standalone token (' ณ <name>' or
  // 'ณ<name>' at a word boundary). A ณ glued to the preceding word —
  // 'บริเวณพัทยา' — is just that word's final character, NOT a surname, and
  // must never suppress the mention.
  const prev = text[index - 1];
  if (prev === ' ') {
    return text[index - 2] === 'ณ' && (index - 2 === 0 || text[index - 3] === ' ');
  }
  if (prev === 'ณ') {
    return index - 1 === 0 || text[index - 2] === ' ';
  }
  return false;
}

function isPublisherMention(text, index) {
  const window = text.slice(Math.max(0, index - PUBLISHER_CUE_WINDOW), index);
  return PUBLISHER_CUES.some((cue) => window.includes(cue));
}

function isHistoryMention(text, index) {
  const before = text.slice(Math.max(0, index - HISTORY_BEFORE_WINDOW), index);
  const after = text.slice(index, index + HISTORY_AFTER_WINDOW);
  return before.includes('เคย') || HISTORY_AFTER_CUES.some((cue) => after.includes(cue));
}

// A locality (local alias) is always more specific than a province-level
// mention, so in a tiebreak it wins regardless of position — otherwise
// 'ประมงชลบุรี …โผล่ทะเลพัทยา' would lose the place to the earlier ชลบุรี.
const KIND_RANK = { local: 0, prefix: 1, province: 1 };

function bySpecificity(a, b) {
  return (KIND_RANK[a.kind] - KIND_RANK[b.kind]) || (a.index - b.index);
}

/**
 * Pick the event province among position-tagged candidates.
 * 1. Event-cued, non-history mention wins (most recent / explicitly located;
 *    a 'เคยพบที่…' historical mention must never win via its 'พบที่' cue).
 * 2. Otherwise the most specific non-demoted mention (locality before
 *    province-level, then earliest).
 * 3. Otherwise the most specific non-surname mention (origin/publisher/
 *    history demotions only break ties — they must not erase the only
 *    location in the text).
 * 4. Only-surnames → null (never extract a surname as a location).
 */
function selectProvinceCandidate(candidates, text) {
  const boosted = candidates.filter((c) => hasEventCue(text, c.index) && !isHistoryMention(text, c.index));
  if (boosted.length > 0) return boosted.sort((a, b) => a.index - b.index)[0];
  const retained = candidates.filter(
    (c) => !isOriginMention(text, c.index) &&
      !isPublisherMention(text, c.index) &&
      !isHistoryMention(text, c.index) &&
      !isSurnameMention(text, c.index)
  );
  if (retained.length > 0) return retained.sort(bySpecificity)[0];
  const nonSurname = candidates.filter((c) => !isSurnameMention(text, c.index));
  if (nonSurname.length > 0) return nonSurname.sort(bySpecificity)[0];
  return null;
}

/**
 * Decode the compacted jquery.Thailand.js database into
 * Map<provinceName, Set<amphoeName>>.
 */
function decodeAdminDatabase() {
  const { lookup, words, data } = rawDatabase;
  const lookupTable = lookup.split('|');
  const dictionary = words.split('|');
  const decode = (text) => {
    if (typeof text === 'number') text = lookupTable[text];
    if (typeof text !== 'string') return '';
    return text.replace(/[A-Za-z]/g, (char) => {
      const code = char.charCodeAt(0);
      return dictionary[code < 97 ? code - 65 : 26 + code - 97] ?? '';
    });
  };
  const provinces = new Map();
  for (const provinceRow of data) {
    const level = provinceRow.length === 3 ? 2 : 1;
    const provinceName = decode(provinceRow[0]);
    if (!provinceName) continue;
    const amphoes = new Set();
    for (const amphoeRow of provinceRow[level] ?? []) {
      // Numeric references are indexes into the shared lookup table.
      const name = decode(amphoeRow[0]);
      if (name) amphoes.add(name);
    }
    provinces.set(provinceName, amphoes);
  }
  return provinces;
}

const PROVINCES = decodeAdminDatabase();
const PROVINCE_NAMES = [...PROVINCES.keys()].sort((a, b) => b.length - a.length);
const ALL_AMPHOES = [...new Set([...PROVINCES.values()].flatMap((set) => [...set]))]
  .sort((a, b) => b.length - a.length);

// Well-documented waterbodies in the EEC study area. Used ONLY for text
// matching — none of these entries carry coordinates, and finding one never
// produces a coordinate.
const EEC_WATERBODIES = [
  'บางปะกง', // แม่น้ำบางปะกง (Bang Pakong River) — Chachoengsao
  'หนองค้อ', // อ่างเก็บน้ำหนองค้อ — Rayong
  'ดอกกราย', // อ่างเก็บน้ำดอกกราย — Chonburi
  'บางพระ', // อ่างเก็บน้ำบางพระ — Chonburi
  'ประแสร์', // แม่น้ำประแสร์ — Rayong/Chanthaburi border
  'ระยอง' // แม่น้ำระยอง / ลำน้ำระยอง — Rayong
];

const PREFIX_PATTERNS = [
  // The shorthand form requires the dot: bare 'จ' is a common letter inside
  // words (แจง, จริง, จำนวน …) and must never open a capture.
  /(?:จังหวัด|จ\.)\s*([\u0e00-\u0e7f]+)/,
  /(?:อำเภอ|อ\.)\s*([\u0e00-\u0e7f]+)/,
  /(?:ตำบล|ต\.)\s*([\u0e00-\u0e7f]+)/,
  /(?:แม่น้ำ|คลอง|ลำน้ำ|หนอง|บึง|อ่างเก็บน้ำ|เขื่อน|ปากน้ำ|ลุ่มน้ำ|ทะเลสาบ)\s*([\u0e00-\u0e7f]+)/
];

const WATERBODY_PREFIXES = ['แม่น้ำ', 'คลอง', 'ลำน้ำ', 'หนอง', 'บึง', 'อ่างเก็บน้ำ', 'เขื่อน', 'ปากน้ำ', 'ลุ่มน้ำ', 'ทะเลสาบ'];

// Thai script range — used for word-boundary checks. Thai text has no spaces,
// so an exact name scan must ensure the match is not buried inside another
// word (e.g. the district 'พล' inside the name 'วัชระพล').
const THAI_CHAR = /[\u0e00-\u0e7f]/;

// Province names that are also common Thai words and therefore need a word
// boundary even at longer lengths ('แพร่' = spread, matched inside
// 'การแพร่ระบาด'). Short names (≤3 chars) always get the boundary check.
const BOUNDARY_FORCED_NAMES = new Set(['แพร่']);

/** True when `index` is a word boundary (start of text or non-Thai char). */
function isBoundaryBefore(text, index) {
  if (index <= 0) return true;
  return !THAI_CHAR.test(text[index - 1]);
}

/** True when this name needs the boundary check at its matched position. */
function needsBoundary(name) {
  return name.length <= 3 || BOUNDARY_FORCED_NAMES.has(name);
}

function bestMatch(candidates, token, threshold) {
  // Single-char tokens are meaningless for fuzzy matching (fuzzball returns
  // degenerate 100 scores for them) — never normalize on them.
  if (String(token).trim().length < 2) return null;
  let best = null;
  for (const candidate of candidates) {
    const score = fuzzball.token_set_ratio(token, candidate);
    if (score >= threshold && (!best || score > best.score)) {
      best = { candidate, score };
    }
  }
  return best;
}

/**
 * Extract a normalized location from observation text.
 * Returns { province, district, subdistrict, waterbody, place, precision,
 * evidence } — all fields nullable; precision is the most specific level
 * actually supported by the text. `place` is the most-specific non-admin
 * locality/site phrase (e.g. หาดพัทยา) when a local alias matched — it is
 * preserved alongside the parent province, never collapsed into it.
 */
export function extractLocation(title, description, sourceLatitude, sourceLongitude) {
  const text = normalizeText(`${title ?? ''} ${description ?? ''}`);
  const evidence = { matched: [], fuzzy: [] };
  let province = null;
  let district = null;
  let subdistrict = null;
  let waterbody = null;
  let place = null;

  // 1. English aliases (latin text normalizes to lowercase).
  for (const alias of ENGLISH_ALIASES) {
    if (text.includes(alias.text)) {
      if (alias.province) province = alias.province;
      if (alias.district) district = alias.district;
      evidence.matched.push(`alias:${alias.text}→${alias.province ?? ''}${alias.district ? `/${alias.district}` : ''}`);
      break;
    }
  }

  // 2. Thai province candidates — collect EVERY mention (exact names,
  // จ./จังหวัด prefix captures, local aliases) with its text position, then
  // rank by context cues. Selection never depends on name length or
  // admin-database order. Exact names are boundary-guarded for short names
  // and skipped when the mention sits inside a waterbody phrase
  // (แม่น้ำระยอง is the river, not a province mention).
  if (!province) {
    const candidates = [];
    for (const name of PROVINCE_NAMES) {
      let from = 0;
      while (true) {
        const index = text.indexOf(name, from);
        if (index < 0) break;
        const boundaryOk = !needsBoundary(name) || isBoundaryBefore(text, index);
        const prefixedByWater = WATERBODY_PREFIXES.some((prefix) =>
          text.slice(Math.max(0, index - prefix.length - 2), index).endsWith(prefix)
        );
        if (boundaryOk && !prefixedByWater) {
          candidates.push({ name, index, kind: 'province' });
        }
        from = index + 1;
      }
    }
    // จ./จังหวัด prefix captures with fuzzy normalization — all occurrences.
    const provincePrefix = /(?:จังหวัด|จ\.)\s*([\u0e00-\u0e7f]+)/g;
    let capture;
    while ((capture = provincePrefix.exec(text)) !== null) {
      const found = bestMatch(PROVINCE_NAMES, capture[1], EXPERIMENTAL_LOCATION_FUZZY_PROVINCE);
      if (found) {
        candidates.push({ name: found.candidate, index: capture.index, kind: 'prefix', raw: capture[1], score: found.score });
      }
    }
    // Local EEC locality aliases (พัทยา → ชลบุรี). The full site phrase
    // (หาดพัทยา, ชายหาดพัทยา …) is carried on the candidate and preserved
    // as the most-specific place.
    for (const alias of LOCAL_ALIASES) {
      let from = 0;
      while (true) {
        const index = text.indexOf(alias.text, from);
        if (index < 0) break;
        candidates.push({
          name: alias.province,
          index,
          kind: 'local',
          raw: alias.text,
          place: placePhrase(text, index, alias.text)
        });
        from = index + 1;
      }
    }
    if (candidates.length > 0) {
      const selected = selectProvinceCandidate(candidates, text);
      if (selected) {
        province = selected.name;
        if (selected.kind === 'prefix') evidence.fuzzy.push(`province:${selected.raw}→${selected.name}(${selected.score})`);
        else if (selected.kind === 'local') {
          place = selected.place;
          evidence.matched.push(`alias:${selected.place}→${selected.name}`);
        } else evidence.matched.push(`province:${selected.name}@${selected.index}`);
      }
    }
  }

  // 4. Waterbodies — a known EEC name counts as a waterbody only when a
  // waterbody prefix (แม่น้ำ/คลอง/หนอง/บ่อ/…) appears right before it, or
  // the name itself begins with a waterbody type word ('หนองค้อ' inside
  // 'บ่อปลาหนองค้อ'). A bare 'ระยอง' is province usage, never the river.
  // The prefix path below still captures explicit แม่น้ำ/คลอง/… phrases.
  for (const waterbodyName of EEC_WATERBODIES) {
    const nameIsPrefixed = WATERBODY_PREFIXES.some((prefix) => waterbodyName.startsWith(prefix));
    let from = 0;
    while (true) {
      const index = text.indexOf(waterbodyName, from);
      if (index < 0) break;
      const window = text.slice(Math.max(0, index - 8), index);
      if (nameIsPrefixed || WATERBODY_PREFIXES.some((prefix) => window.includes(prefix))) {
        waterbody = waterbodyName;
        evidence.matched.push(`waterbody:${waterbodyName}`);
        break;
      }
      from = index + 1;
    }
    if (waterbody) break;
  }
  if (!waterbody) {
    const match = PREFIX_PATTERNS[3].exec(text);
    if (match) {
      const capture = match[1];
      // Prefer the longest known waterbody that is a PREFIX of the capture
      // (handles "ลุ่มน้ำบางปะกงจับได้ทุกวัน" → บางปะกง). Unknown short
      // captures (≤8 chars, e.g. ใหม่บางปู) are accepted; long captures like
      // "กำจัดปลาหมอคางดำ" are rejected.
      const known = EEC_WATERBODIES.find((name) => capture.startsWith(name));
      if (known) {
        waterbody = known;
        evidence.matched.push(`waterbody(prefix):${known}`);
      } else if (capture.length >= WATERBODY_CAPTURE_MIN_LEN && capture.length <= WATERBODY_CAPTURE_MAX_LEN) {
        waterbody = capture;
        evidence.matched.push(`waterbody(prefix):${capture}`);
      }
    }
  }

  // 5. Districts: อ./อำเภอ prefix first, then exact amphoe names. A name that
  // was already captured as a waterbody is not re-claimed as a district.
  const prefixDistrict = PREFIX_PATTERNS[1].exec(text);
  if (prefixDistrict) {
    const found = bestMatch(ALL_AMPHOES, prefixDistrict[1], EXPERIMENTAL_LOCATION_FUZZY_DISTRICT);
    if (found) {
      district = found.candidate;
      evidence.fuzzy.push(`district:${prefixDistrict[1]}→${found.candidate}(${found.score})`);
    }
  }
  if (!district) {
    for (const name of ALL_AMPHOES) {
      if (name === waterbody) continue;
      const index = text.indexOf(name);
      // Boundary check only for short names: 'พล' inside 'วัชระพล' or 'ลอง'
      // inside 'คลอง' must not match, while 'บางละมุง' inside
      // 'คลองบางละมุง' is a legitimate mention.
      if (index >= 0 && (!needsBoundary(name) || isBoundaryBefore(text, index))) {
        district = name;
        evidence.matched.push(`district:${name}`);
        break;
      }
    }
  }

  // 6. Subdistricts (ตำบล/ต.).
  const prefixSub = PREFIX_PATTERNS[2].exec(text);
  if (prefixSub) {
    subdistrict = prefixSub[1];
    evidence.matched.push(`subdistrict:${subdistrict}`);
  }

  // Precision: most specific level actually supported — never invented.
  // Admin units (subdistrict/district) rank above a waterbody name, since a
  // district places the observation in the administrative hierarchy while a
  // waterbody mention alone does not.
  let precision = 'UNKNOWN';
  if (sourceLatitude !== null && sourceLatitude !== undefined && sourceLongitude !== null && sourceLongitude !== undefined) {
    precision = 'EXACT';
  } else if (subdistrict) {
    precision = 'SUBDISTRICT';
  } else if (district) {
    precision = 'DISTRICT';
  } else if (waterbody) {
    precision = 'WATERBODY';
  } else if (province) {
    precision = 'PROVINCE';
  }

  return { province, district, subdistrict, waterbody, place, precision, evidence };
}

export function listProvinces() {
  return [...PROVINCES.keys()];
}

export function listAmphoes() {
  return ALL_AMPHOES;
}
