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
 * Returns { province, district, subdistrict, waterbody, precision, evidence }
 * — all fields nullable; precision is the most specific level actually
 * supported by the text.
 */
export function extractLocation(title, description, sourceLatitude, sourceLongitude) {
  const text = normalizeText(`${title ?? ''} ${description ?? ''}`);
  const evidence = { matched: [], fuzzy: [] };
  let province = null;
  let district = null;
  let subdistrict = null;
  let waterbody = null;

  // 1. English aliases (latin text normalizes to lowercase).
  for (const alias of ENGLISH_ALIASES) {
    if (text.includes(alias.text)) {
      if (alias.province) province = alias.province;
      if (alias.district) district = alias.district;
      evidence.matched.push(`alias:${alias.text}→${alias.province ?? ''}${alias.district ? `/${alias.district}` : ''}`);
      break;
    }
  }

  // 2. Exact province names (longest first). Boundary check applies only to
  // short names (e.g. 'เลย') that can hide inside unrelated words; longer
  // names like 'ระยอง' inside 'ประมงระยอง' are legitimately matched.
  if (!province) {
    for (const name of PROVINCE_NAMES) {
      const index = text.indexOf(name);
      if (index >= 0 && (!needsBoundary(name) || isBoundaryBefore(text, index))) {
        province = name;
        evidence.matched.push(`province:${name}`);
        break;
      }
    }
  }

  // 3. จ./จังหวัด prefix capture with fuzzy normalization.
  if (!province) {
    const match = PREFIX_PATTERNS[0].exec(text);
    if (match) {
      const found = bestMatch(PROVINCE_NAMES, match[1], 85);
      if (found) {
        province = found.candidate;
        evidence.fuzzy.push(`province:${match[1]}→${found.candidate}(${found.score})`);
      }
    }
  }

  // 4. Waterbodies — detected first so a prefixed mention like
  // "ลุ่มน้ำบางปะกง" is treated as a basin reference, not the district.
  for (const waterbodyName of EEC_WATERBODIES) {
    const index = text.indexOf(waterbodyName);
    if (index >= 0 && isBoundaryBefore(text, index)) {
      waterbody = waterbodyName;
      evidence.matched.push(`waterbody:${waterbodyName}`);
      break;
    }
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
      } else if (capture.length >= 4 && capture.length <= 8) {
        waterbody = capture;
        evidence.matched.push(`waterbody(prefix):${capture}`);
      }
    }
  }

  // 5. Districts: อ./อำเภอ prefix first, then exact amphoe names. A name that
  // was already captured as a waterbody is not re-claimed as a district.
  const prefixDistrict = PREFIX_PATTERNS[1].exec(text);
  if (prefixDistrict) {
    const found = bestMatch(ALL_AMPHOES, prefixDistrict[1], 80);
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

  return { province, district, subdistrict, waterbody, precision, evidence };
}

export function listProvinces() {
  return [...PROVINCES.keys()];
}

export function listAmphoes() {
  return ALL_AMPHOES;
}
