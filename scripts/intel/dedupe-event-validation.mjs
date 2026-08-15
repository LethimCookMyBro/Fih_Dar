// Dedupe + event grouping validation — frozen controlled test set.
//
//   node scripts/intel/dedupe-event-validation.mjs
//
// Two SEPARATE target properties, evaluated separately:
//   PROPERTY A — ARTICLE DUPLICATE: two records represent the same article /
//                effectively identical syndicated copy (findNearDuplicates).
//   PROPERTY B — SAME REAL-WORLD EVENT: two legitimate articles describe the
//                same incident (resolveEvents), even when they are not
//                duplicate articles.
//
// Expected labels were fixed BEFORE the first run (see
// docs/FIHDAR_DEDUPE_EVENT_VALIDATION.md). A deterministic fingerprint over
// the case definitions is printed so the benchmark is frozen and reproducible.
// Event cases use the real semantic path (local e5 embeddings, cached); when
// the model is unavailable the runner degrades to keyword-only and says so.
// This script measures the current implementation only — it does NOT modify
// any logic, threshold, or the DB.

import { createHash } from 'node:crypto';

import { findNearDuplicates } from './dedupe.mjs';
import { resolveEvents } from './events.mjs';
import { embedTexts } from './embed.mjs';

// ---------------------------------------------------------------------------
// A. DEDUPE CASES — pairs; expectedDuplicate is PROPERTY A.
// ---------------------------------------------------------------------------
const DEDUPE_CASES = [
  // --- Clear duplicates (expected true) --------------------------------------
  {
    id: 'd1', expectedDuplicate: true, note: 'exact same title + body + URL',
    a: { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา ชาวบ้านหวั่นกระทบระบบนิเวศ', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://example.com/news/1' },
    b: { id: 'B', title: 'ปลาหมอคางดำบุกหาดพัทยา ชาวบ้านหวั่นกระทบระบบนิเวศ', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://example.com/news/1' }
  },
  {
    id: 'd2', expectedDuplicate: true, note: 'same article, google news tracking params on URL',
    a: { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://news.google.com/rss/articles/ABC?oc=5&co=1' },
    b: { id: 'B', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://news.google.com/rss/articles/ABC' }
  },
  {
    id: 'd3', expectedDuplicate: true, note: 'same source article collected twice (different external id)',
    a: { id: 'A', title: 'ปลาหมอคางดำระบาดที่คลองตำหรุ', description: 'ประมงชลบุรีลุยจับปลาหมอคางดำในคลองตำหรุได้กว่า 2 ตัน', sourceUrl: 'https://example.com/news/2' },
    b: { id: 'B', title: 'ปลาหมอคางดำระบาดที่คลองตำหรุ', description: 'ประมงชลบุรีลุยจับปลาหมอคางดำในคลองตำหรุได้กว่า 2 ตัน', sourceUrl: 'https://example.com/news/2' }
  },
  {
    id: 'd4', expectedDuplicate: true, note: 'tiny punctuation / spacing differences',
    a: { id: 'A', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำ เกยตื้น ริมชายหาด', sourceUrl: 'https://example.com/news/3' },
    b: { id: 'B', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำเกยตื้นริมชายหาด', sourceUrl: 'https://example.com/news/3' }
  },
  {
    id: 'd5', expectedDuplicate: true, note: 'syndicated near-identical copy, tiny wording delta',
    a: { id: 'A', title: 'พบปลาหมอคางดำที่ชายหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://a.example.com/news/1' },
    b: { id: 'B', title: 'เจอปลาหมอคางดำบริเวณหาดพัทยา', description: 'ชาวบ้านเจอปลาหมอคางดำจำนวนมากบริเวณหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://b.example.com/news/1' }
  },
  {
    id: 'd6', expectedDuplicate: true, note: 'reordered headline, identical body',
    a: { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://example.com/news/4' },
    b: { id: 'B', title: 'หาดพัทยาถูกปลาหมอคางดำบุก', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://example.com/news/4' }
  },
  {
    id: 'd12', expectedDuplicate: true, note: 'article updated later with minor title change',
    a: { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://example.com/news/5' },
    b: { id: 'B', title: 'ปลาหมอคางดำบุกหาดพัทยา (อัปเดต) ประมงลงพื้นที่แล้ว', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา และแจ้งหน่วยงานประมงเข้าตรวจสอบ', sourceUrl: 'https://example.com/news/5' }
  },
  {
    id: 'd14', expectedDuplicate: true, note: 'mirrored article on another domain',
    a: { id: 'A', title: 'ปลาหมอคางดำโผล่ทะเลพัทยา', description: 'นักตกปลาพบปลาหมอคางดำบุกทะเลพัทยาจำนวนมาก หวั่นทำลายระบบนิเวศ', sourceUrl: 'https://x.example.com/news/1' },
    b: { id: 'B', title: 'ปลาหมอคางดำโผล่ทะเลพัทยา', description: 'นักตกปลาพบปลาหมอคางดำบุกทะเลพัทยาจำนวนมาก หวั่นทำลายระบบนิเวศ', sourceUrl: 'https://y.example.com/news/1' }
  },
  {
    id: 'd17', expectedDuplicate: true, note: 'same title+body on two dates (dedupe is time-blind)',
    a: { id: 'A', title: 'พบปลาหมอคางดำอีกครั้งที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำอีกครั้งบริเวณหาดพัทยา และแจ้งหน่วยงานเข้าตรวจสอบ', sourceUrl: 'https://example.com/news/6' },
    b: { id: 'B', title: 'พบปลาหมอคางดำอีกครั้งที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำอีกครั้งบริเวณหาดพัทยา และแจ้งหน่วยงานเข้าตรวจสอบ', sourceUrl: 'https://example.com/news/6' }
  },

  // --- Clear non-duplicates (expected false) ---------------------------------
  {
    id: 'd7', expectedDuplicate: false, note: 'same province, different incident',
    a: { id: 'A', title: 'ชาวบ้านพบปลาหมอคางดำที่คลองตำหรุ', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากในคลองตำหรุ จังหวัดชลบุรี', sourceUrl: 'https://example.com/news/7' },
    b: { id: 'B', title: 'ชาวประมงจับปลาหมอคางดำได้ที่อ่างเก็บน้ำดอกกราย', description: 'ชาวประมงจับปลาหมอคางดำได้ตัวใหญ่ที่อ่างเก็บน้ำดอกกราย จังหวัดชลบุรี', sourceUrl: 'https://example.com/news/8' }
  },
  {
    id: 'd8', expectedDuplicate: false, note: 'same species, different subject (sighting vs removal campaign)',
    a: { id: 'A', title: 'พบปลาหมอคางดำเกยตื้นชายหาดพัทยา', description: 'นักท่องเที่ยวพบปลาหมอคางดำเกยตื้นบริเวณชายหาดพัทยา', sourceUrl: 'https://example.com/news/9' },
    b: { id: 'B', title: 'เปิดจุดรับซื้อปลาหมอคางดำ กก.ละ 15 บาท', description: 'กรมประมงเปิดจุดรับซื้อปลาหมอคางดำเพื่อกำจัดประชากร', sourceUrl: 'https://example.com/news/10' }
  },
  {
    id: 'd9', expectedDuplicate: false, note: 'same publisher, different article',
    a: { id: 'A', title: 'ราคาปลาหมอคางดำตลาดวันนี้พุ่ง', description: 'ราคาปลาหมอคางดำในตลาดปรับตัวสูงขึ้นตามความต้องการ', sourceUrl: 'https://example.com/news/11' },
    b: { id: 'B', title: 'ปลาหมอคางดำระบาดต่อเนื่องในคลอง', description: 'การระบาดของปลาหมอคางดำยังไม่คลี่คลายในหลายพื้นที่', sourceUrl: 'https://example.com/news/12' }
  },
  {
    id: 'd10', expectedDuplicate: false, note: 'similar title but different place',
    a: { id: 'A', title: 'พบปลาหมอคางดำที่ชายหาดพัทยา', description: 'พบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา', sourceUrl: 'https://example.com/news/13' },
    b: { id: 'B', title: 'พบปลาหมอคางดำที่ชายหาดบางแสน', description: 'พบปลาหมอคางดำจำนวนมากบริเวณชายหาดบางแสน', sourceUrl: 'https://example.com/news/14' }
  },
  {
    id: 'd11', expectedDuplicate: false, note: 'same place, substantially different incident',
    a: { id: 'A', title: 'จัดงานประกวดกินปลาหมอคางดำที่พัทยา', description: 'เทศบาลจัดงานประกวดกินปลาหมอคางดำริมชายหาดพัทยา', sourceUrl: 'https://example.com/news/15' },
    b: { id: 'B', title: 'ปลาหมอคางดำเกยตื้นชายหาดพัทยา', description: 'ปลาหมอคางดำเกยตื้นบริเวณชายหาดพัทยาเป็นจำนวนมาก', sourceUrl: 'https://example.com/news/16' }
  },
  {
    id: 'd13', expectedDuplicate: false, note: 'generic headline, different provinces',
    a: { id: 'A', title: 'พบปลาหมอคางดำอีกครั้งในคลอง', description: 'ชาวบ้านชลบุรีพบปลาหมอคางดำอีกครั้งในคลองตำหรุ', sourceUrl: 'https://example.com/news/17' },
    b: { id: 'B', title: 'พบปลาหมอคางดำอีกครั้งในคลอง', description: 'ชาวบ้านระยองพบปลาหมอคางดำอีกครั้งในคลองบ้านเพ', sourceUrl: 'https://example.com/news/18' }
  },
  {
    id: 'd15', expectedDuplicate: false, note: 'shared boilerplate excerpt, different event details',
    a: { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านหวั่นกระทบระบบนิเวศ หน่วยงานเร่งตรวจสอบ พบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceUrl: 'https://example.com/news/19' },
    b: { id: 'B', title: 'ปลาหมอคางดำบุกคลองบางปะกง', description: 'ชาวบ้านหวั่นกระทบระบบนิเวศ หน่วยงานเร่งตรวจสอบ พบปลาหมอคางดำจำนวนมากที่คลองบางปะกง', sourceUrl: 'https://example.com/news/20' }
  },
  {
    id: 'd16', expectedDuplicate: false, note: 'fully paraphrased rewrite by another outlet (different article; same-event is PROPERTY B)',
    a: { id: 'A', title: 'พบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา นักท่องเที่ยวตกใจ', description: 'นักท่องเที่ยวพบปลาหมอคางดำเกลื่อนชายหาดพัทยา และแจ้งเจ้าหน้าที่เข้าตรวจสอบพื้นที่', sourceUrl: 'https://a.example.com/news/2' },
    b: { id: 'B', title: 'นักท่องเที่ยวผวา ฝูงปลาหมอคางดำบุกชายหาดพัทยา', description: 'ฝูงปลาหมอคางดำบุกชายหาดพัทยา สร้างความตื่นตระหนกแก่นักท่องเที่ยว หน่วยงานเร่งลงพื้นที่', sourceUrl: 'https://b.example.com/news/2' }
  },
  {
    id: 'd18', expectedDuplicate: false, note: 'Thai vs English summary of same incident (no cross-lingual dedupe)',
    a: { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'พบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceUrl: 'https://example.com/news/21' },
    b: { id: 'B', title: 'Blackchin tilapia invades Pattaya beach', description: 'Large numbers of blackchin tilapia found at Pattaya beach', sourceUrl: 'https://example.com/news/21' }
  }
];

// ---------------------------------------------------------------------------
// B. EVENT GROUPING CASES — groups; expectedClusters is PROPERTY B (the
//    partition of member ids into same-event clusters; singletons are their
//    own cluster). Rule for follow-ups (documented): the current model has no
//    event-phase concept — follow-ups group iff location + time + lexical
//    agreement hold (same as any other pair).
// ---------------------------------------------------------------------------
const EVENT_CASES = [
  // --- Same real-world event (expected same cluster) --------------------------
  {
    id: 'e1', expectedClusters: [['A', 'B']], note: 'same incident, two publishers, moderately different text',
    rows: [
      { id: 'A', title: 'พบปลาหมอคางดำบริเวณชายหาดพัทยา ชาวบ้านแจ้งเจ้าหน้าที่เข้าตรวจสอบ', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากบริเวณชายหาดพัทยา จึงแจ้งเจ้าหน้าที่ประมงเข้าตรวจสอบพื้นที่', sourceName: 'ThaiPBS', sourceExternalId: 't1', publishedAt: '2026-05-14T08:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'เจ้าหน้าที่ลงตรวจปลาหมอคางดำที่หาดพัทยา หลังประชาชนแจ้งพบ', description: 'เจ้าหน้าที่ประมงลงตรวจสอบบริเวณหาดพัทยาหลังประชาชนแจ้งพบปลาหมอคางดำจำนวนมาก', sourceName: 'PPTV', sourceExternalId: 'p1', publishedAt: '2026-05-14T10:30:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e2', expectedClusters: [['A', 'B']], note: 'near-identical syndicated report of one incident',
    rows: [
      { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำบุกหาดพัทยาจำนวนมาก', sourceName: 'Ch7', sourceExternalId: 'c1', publishedAt: '2026-05-15T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ปลาหมอคางดำบุกหาดพัทยา ชาวบ้านจับได้จำนวนมาก', description: 'ชาวบ้านพบปลาหมอคางดำบุกหาดพัทยาจำนวนมากและจับได้ต่อเนื่อง', sourceName: 'DailyNews', sourceExternalId: 'd1', publishedAt: '2026-05-15T09:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e3', expectedClusters: [['A', 'B']], note: 'background history in Samut Sakhon; both report the NEW Pattaya event',
    rows: [
      { id: 'A', title: 'เคยพบที่สมุทรสาคร แต่ล่าสุดปลาหมอคางดำโผล่ชายหาดพัทยา', description: 'ปัญหาปลาหมอคางดำเคยพบในสมุทรสาคร แต่ล่าสุดพบการระบาดที่ชายหาดพัทยา', sourceName: 'ThaiPBS', sourceExternalId: 't2', publishedAt: '2026-05-16T08:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ปลาหมอคางดำบุกชายหาดพัทยา ชาวบ้านกังวล', description: 'ปลาหมอคางดำบุกชายหาดพัทยา ชาวบ้านในพื้นที่แสดงความกังวล', sourceName: 'PPTV', sourceExternalId: 'p2', publishedAt: '2026-05-16T12:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e4', expectedClusters: [['A', 'B']], note: 'follow-up cleanup operation, similar text within window (documented rule: groups)',
    rows: [
      { id: 'A', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c2', publishedAt: '2026-05-14T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ประมงชลบุรีลงจับปลาหมอคางดำที่หาดพัทยา หลังพบการระบาด', description: 'เจ้าหน้าที่ประมงลงพื้นที่หาดพัทยาจับปลาหมอคางดำหลังพบการระบาด', sourceName: 'PPTV', sourceExternalId: 'p3', publishedAt: '2026-05-17T09:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'CONTROL_REMOVAL' }
    ]
  },
  {
    id: 'e5', expectedClusters: [['A', 'B', 'C']], note: 'one incident, three outlets',
    rows: [
      { id: 'A', title: 'ปลาหมอคางดำโผล่ทะเลพัทยา', description: 'นักตกปลาพบปลาหมอคางดำบุกทะเลพัทยาจำนวนมาก', sourceName: 'Thairath', sourceExternalId: 'tr1', publishedAt: '2026-05-18T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'นักตกปลาผวาปลาหมอคางดำบุกทะเลพัทยา', description: 'นักตกปลาพบปลาหมอคางดำบุกทะเลพัทยาจำนวนมาก หวั่นระบบนิเวศ', sourceName: 'DailyNews', sourceExternalId: 'd2', publishedAt: '2026-05-18T10:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'C', title: 'ทะเลพัทยาเจอปลาหมอคางดำเป็นฝูง', description: 'นักตกปลาพบปลาหมอคางดำเป็นฝูงบริเวณทะเลพัทยา', sourceName: 'Matichon', sourceExternalId: 'm1', publishedAt: '2026-05-18T14:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e14', expectedClusters: [['A', 'B']], note: 'undated report attaches to the dated cluster (same text family)',
    rows: [
      { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำบุกหาดพัทยาจำนวนมาก', sourceName: 'Ch7', sourceExternalId: 'c3', publishedAt: '2026-05-20T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำบุกหาดพัทยาจำนวนมาก', sourceName: 'Online', sourceExternalId: 'o1', publishedAt: null, scrapedAt: '2026-05-20T09:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e16', expectedClusters: [['A', 'B']], note: 'official announcement + news coverage of the same discovery',
    rows: [
      { id: 'A', title: 'กรมประมงยืนยันพบปลาหมอคางดำที่หาดพัทยา', description: 'กรมประมงยืนยันพบปลาหมอคางดำบริเวณหาดพัทยา หลังตรวจสอบพื้นที่', sourceName: 'Fisheries', sourceExternalId: 'f1', publishedAt: '2026-05-21T06:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ยันพบจริง ปลาหมอคางดำโผล่หาดพัทยา', description: 'กรมประมงยืนยันพบปลาหมอคางดำที่หาดพัทยาจริง หลังตรวจสอบ', sourceName: 'BangkokBiz', sourceExternalId: 'bb1', publishedAt: '2026-05-21T11:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },

  // --- Different events (expected separate clusters) --------------------------
  {
    id: 'e6', expectedClusters: [['A'], ['B']], note: 'same place, independent incidents ~2 weeks apart, distinct text',
    rows: [
      { id: 'A', title: 'ฝูงปลาหมอคางดำบุกหาดพัทยา นักท่องเที่ยวตกใจ', description: 'ฝูงปลาหมอคางดำบุกชายหาดพัทยา สร้างความตื่นตระหนกแก่นักท่องเที่ยว', sourceName: 'Thairath', sourceExternalId: 'tr2', publishedAt: '2026-05-10T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ชาวประมงจับปลาหมอคางดำที่หาดพัทยาได้เกือบร้อยตัว', description: 'ชาวประมงจับปลาหมอคางดำได้เกือบร้อยตัวบริเวณหาดพัทยา', sourceName: 'PPTV', sourceExternalId: 'p4', publishedAt: '2026-05-22T09:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e7', expectedClusters: [['A'], ['B']], note: 'identical text but 30 days apart (> 21-day window)',
    rows: [
      { id: 'A', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c4', publishedAt: '2026-05-01T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c5', publishedAt: '2026-05-31T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e8', expectedClusters: [['A'], ['B']], note: 'same day, different provinces (Pattaya vs Bang Pakong)',
    rows: [
      { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'พบปลาหมอคางดำบุกหาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c6', publishedAt: '2026-05-19T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ปลาหมอคางดำบุกคลองบางปะกง', description: 'พบปลาหมอคางดำบุกคลองบางปะกง', sourceName: 'ThaiPBS', sourceExternalId: 't3', publishedAt: '2026-05-19T07:00:00Z', normalizedProvince: 'ฉะเชิงเทรา', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e9', expectedClusters: [['A'], ['B']], note: 'same province, different localities, distinct text',
    rows: [
      { id: 'A', title: 'ฝูงปลาหมอคางดำเกยตื้นหาดพัทยา', description: 'ฝูงปลาหมอคางดำเกยตื้นบริเวณหาดพัทยา', sourceName: 'Thairath', sourceExternalId: 'tr3', publishedAt: '2026-05-23T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ชาวบ้านบางแสนจับปลาหมอคางดำได้ตัวใหญ่', description: 'ชาวบ้านบางแสนจับปลาหมอคางดำได้ตัวใหญ่จากทะเล', sourceName: 'PPTV', sourceExternalId: 'p5', publishedAt: '2026-05-23T09:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e10', expectedClusters: [['A'], ['B']], note: 'same place and day, different incident kinds (buyback vs sighting)',
    rows: [
      { id: 'A', title: 'เปิดศูนย์รับซื้อปลาหมอคางดำที่พัทยา', description: 'เปิดจุดรับซื้อปลาหมอคางดำที่พัทยา กก.ละ 15 บาท', sourceName: 'Fisheries', sourceExternalId: 'f2', publishedAt: '2026-05-24T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'CONTROL_REMOVAL' },
      { id: 'B', title: 'ปลาหมอคางดำเกยตื้นหาดพัทยา', description: 'ปลาหมอคางดำเกยตื้นบริเวณหาดพัทยาเป็นจำนวนมาก', sourceName: 'Ch7', sourceExternalId: 'c7', publishedAt: '2026-05-24T09:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e11', expectedClusters: [['A'], ['B']], note: 'generic undated, no province — insufficient evidence (limitation documented)',
    rows: [
      { id: 'A', title: 'พบปลาหมอคางดำอีกครั้ง', description: 'พบปลาหมอคางดำอีกครั้งในแหล่งน้ำ', sourceName: 'X', sourceExternalId: 'x1', publishedAt: null, normalizedProvince: null, relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'พบปลาหมอคางดำอีกครั้ง', description: 'พบปลาหมอคางดำอีกครั้งในแหล่งน้ำ', sourceName: 'Y', sourceExternalId: 'y1', publishedAt: null, normalizedProvince: null, relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e12', expectedClusters: [['A'], ['B']], note: 'sighting vs national policy follow-up, distinct text',
    rows: [
      { id: 'A', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำบุกหาดพัทยาจำนวนมาก', sourceName: 'Ch7', sourceExternalId: 'c8', publishedAt: '2026-05-15T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'กรมประมงแถลงแผนรับมือปลาหมอคางดำระดับประเทศ', description: 'กรมประมงแถลงมาตรการรับมือการระบาดของปลาหมอคางดำทั่วประเทศ', sourceName: 'ThaiPBS', sourceExternalId: 't4', publishedAt: '2026-05-20T09:00:00Z', normalizedProvince: null, relevanceKind: 'POLICY' }
    ]
  },
  {
    id: 'e13', expectedClusters: [['A'], ['B']], note: 'RISK CASE — identical text, two dates 18 days apart (both within the 21-day window)',
    rows: [
      { id: 'A', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c9', publishedAt: '2026-05-02T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c10', publishedAt: '2026-05-20T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e19', expectedClusters: [['A'], ['B']], note: 'RISK CASE — identical text, 10 days apart (well inside the 21-day window; sharper than e13)',
    rows: [
      { id: 'A', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c12', publishedAt: '2026-05-10T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'พบปลาหมอคางดำที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากที่หาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c13', publishedAt: '2026-05-20T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e15', expectedClusters: [['A'], ['B']], note: 'RISK CASE — same province, similar text, different locality',
    rows: [
      { id: 'A', title: 'ปลาหมอคางดำโผล่หาดพัทยา', description: 'พบปลาหมอคางดำโผล่หาดพัทยา', sourceName: 'Ch7', sourceExternalId: 'c11', publishedAt: '2026-05-25T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ปลาหมอคางดำโผล่บางแสน', description: 'พบปลาหมอคางดำโผล่บางแสน', sourceName: 'PPTV', sourceExternalId: 'p6', publishedAt: '2026-05-25T09:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e17', expectedClusters: [['A'], ['B']], note: 'different province + different date + different text',
    rows: [
      { id: 'A', title: 'ปลาหมอคางดำระบาดที่คลองตำหรุ', description: 'ประมงชลบุรีลุยจับปลาหมอคางดำในคลองตำหรุได้กว่า 2 ตัน', sourceName: 'Khaosod', sourceExternalId: 'k1', publishedAt: '2026-05-11T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
      { id: 'B', title: 'ปลาหมอคางดำโผล่แม่น้ำระยอง', description: 'พบปลาหมอคางดำในแม่น้ำระยอง ชาวบ้านแจ้งหน่วยงาน', sourceName: 'ThaiPBS', sourceExternalId: 't5', publishedAt: '2026-06-05T09:00:00Z', normalizedProvince: 'ระยอง', relevanceKind: 'SIGHTING' }
    ]
  },
  {
    id: 'e18', expectedClusters: [['A'], ['B']], note: 'same place, similar date, different operation (cleanup vs eating contest)',
    rows: [
      { id: 'A', title: 'ประมงชลบุรีลงกำจัดปลาหมอคางดำที่หาดพัทยา', description: 'เจ้าหน้าที่ประมงลงพื้นที่กำจัดปลาหมอคางดำที่หาดพัทยา', sourceName: 'PPTV', sourceExternalId: 'p7', publishedAt: '2026-05-26T07:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'CONTROL_REMOVAL' },
      { id: 'B', title: 'จัดประกวดกินปลาหมอคางดำที่หาดพัทยา', description: 'จัดกิจกรรมประกวดกินปลาหมอคางดำบริเวณหาดพัทยา', sourceName: 'Matichon', sourceExternalId: 'm2', publishedAt: '2026-05-28T09:00:00Z', normalizedProvince: 'ชลบุรี', relevanceKind: 'CONTROL_REMOVAL' }
    ]
  }
];

// ---------------------------------------------------------------------------
// Frozen fingerprint + evaluation
// ---------------------------------------------------------------------------
const FINGERPRINT = createHash('sha256')
  .update(
    JSON.stringify({
      dedupe: DEDUPE_CASES.map((c) => [c.id, c.expectedDuplicate, c.a.title, c.a.description, c.b.title, c.b.description]),
      events: EVENT_CASES.map((c) => [c.id, JSON.stringify(c.expectedClusters), c.rows.map((r) => [r.id, r.title, r.description, r.publishedAt, r.normalizedProvince])])
    })
  )
  .digest('hex')
  .slice(0, 16);

function dedupeResult(caseDef) {
  const map = findNearDuplicates([caseDef.a, caseDef.b]);
  // later row is 'B'; only B can be flagged against A.
  return map.has('B');
}

function actualClusters(candidates, memberIds) {
  const clusters = [];
  for (const candidate of candidates) {
    const ids = candidate.members.map((m) => m.id).sort();
    if (ids.length > 1) clusters.push(ids);
  }
  const grouped = new Set(clusters.flat());
  for (const id of memberIds) {
    if (!grouped.has(id)) clusters.push([id]); // singleton
  }
  return clusters.map((c) => c.slice().sort()).sort((a, b) => a[0].localeCompare(b[0]));
}

function clustersMatch(actual, expected) {
  const norm = (clusters) => clusters.map((c) => c.slice().sort()).sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(norm(actual)) === JSON.stringify(norm(expected));
}

async function main() {
  // ---- dedupe ----
  console.log('=== ARTICLE DEDUPLICATION (PROPERTY A) ===');
  const d = [];
  for (const c of DEDUPE_CASES) {
    const actual = dedupeResult(c);
    const ok = actual === c.expectedDuplicate;
    d.push({ ...c, actual, ok });
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${c.id} | expected=${c.expectedDuplicate} actual=${actual} | ${c.note}`);
  }
  const dTP = d.filter((x) => x.expectedDuplicate && x.actual).length;
  const dTN = d.filter((x) => !x.expectedDuplicate && !x.actual).length;
  const dFP = d.filter((x) => !x.expectedDuplicate && x.actual).length;
  const dFN = d.filter((x) => x.expectedDuplicate && !x.actual).length;
  const dAcc = (dTP + dTN) / d.length;
  const dPrec = dTP + dFP > 0 ? dTP / (dTP + dFP) : null;
  const dRec = dTP + dFN > 0 ? dTP / (dTP + dFN) : null;
  const dF1 = dPrec !== null && dRec !== null && dPrec + dRec > 0 ? (2 * dPrec * dRec) / (dPrec + dRec) : null;
  console.log(`  cases=${d.length} fingerprint=${FINGERPRINT}`);
  console.log(`  TP=${dTP} TN=${dTN} FP=${dFP} FN=${dFN} | accuracy=${dAcc.toFixed(3)} precision=${dPrec?.toFixed(3) ?? '—'} recall=${dRec?.toFixed(3) ?? '—'} F1=${dF1?.toFixed(3) ?? '—'}`);
  console.log('  false positives (dangerous merges):', d.filter((x) => !x.expectedDuplicate && x.actual).map((x) => x.id).join(', ') || 'none');
  console.log('  false negatives (missed duplicates):', d.filter((x) => x.expectedDuplicate && !x.actual).map((x) => x.id).join(', ') || 'none');

  // ---- events (semantic path when the model is available) ----
  console.log('\n=== REAL-WORLD EVENT GROUPING (PROPERTY B) ===');
  const allTexts = [];
  const textIndex = new Map();
  for (const c of EVENT_CASES) {
    for (const r of c.rows) {
      const t = `${r.title} ${r.description ?? ''}`.trim();
      if (!textIndex.has(t)) {
        textIndex.set(t, allTexts.length);
        allTexts.push(t);
      }
    }
  }
  const embedded = await embedTexts(allTexts);
  let vectorsByObservation = null;
  if (embedded.vectors) {
    vectorsByObservation = new Map();
    for (const c of EVENT_CASES) {
      for (const r of c.rows) {
        const t = `${r.title} ${r.description ?? ''}`.trim();
        vectorsByObservation.set(r.id, embedded.vectors[textIndex.get(t)]);
      }
    }
  } else {
    console.log(`  NOTE: embeddings unavailable (${embedded.reason}) — event pairs evaluated keyword-only (fuzzy + jaccard).`);
  }

  const e = [];
  for (const c of EVENT_CASES) {
    // resolveEvents expects Date objects (as process.mjs passes from Prisma) —
    // normalize the ISO strings here so the runner exercises the real path.
    const rows = c.rows.map((r) => ({
      ...r,
      publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
      scrapedAt: r.scrapedAt ? new Date(r.scrapedAt) : null
    }));
    let candidates;
    let error = null;
    try {
      candidates = resolveEvents(rows, vectorsByObservation);
    } catch (err) {
      error = String(err?.message ?? err);
      candidates = [];
    }
    const actual = error ? null : actualClusters(candidates, c.rows.map((r) => r.id));
    const ok = !error && clustersMatch(actual, c.expectedClusters);
    e.push({ ...c, actual, ok, error });
    if (error) {
      console.log(`  CRASH ${c.id} | expected=${JSON.stringify(c.expectedClusters)} actual=THREW | ${c.note} | ${error}`);
    } else {
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${c.id} | expected=${JSON.stringify(c.expectedClusters)} actual=${JSON.stringify(actual)} | ${c.note}`);
    }
  }

  // pair-level confusion across every unordered pair in every case
  let eTP = 0, eTN = 0, eFP = 0, eFN = 0;
  const merges = [];
  const splits = [];
  for (const c of e) {
    if (c.error) continue; // crashed case — excluded from pair metrics, reported separately
    const members = c.rows.map((r) => r.id);
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const x = members[i];
        const y = members[j];
        const expectedSame = c.expectedClusters.some((cluster) => cluster.includes(x) && cluster.includes(y));
        const actualSame = c.actual.some((cluster) => cluster.includes(x) && cluster.includes(y));
        if (expectedSame && actualSame) eTP += 1;
        else if (!expectedSame && !actualSame) eTN += 1;
        else if (!expectedSame && actualSame) { eFP += 1; merges.push(`${c.id}:${x}-${y}`); }
        else { eFN += 1; splits.push(`${c.id}:${x}-${y}`); }
      }
    }
  }
  const eTotal = eTP + eTN + eFP + eFN;
  const eAcc = (eTP + eTN) / eTotal;
  const ePrec = eTP + eFP > 0 ? eTP / (eTP + eFP) : null;
  const eRec = eTP + eFN > 0 ? eTP / (eTP + eFN) : null;
  const eF1 = ePrec !== null && eRec !== null && ePrec + eRec > 0 ? (2 * ePrec * eRec) / (ePrec + eRec) : null;
  console.log(`  cases=${e.length} | pairs=${eTotal} | cluster-correct=${e.filter((x) => x.ok).length}/${e.length}`);
  console.log(`  TP=${eTP} TN=${eTN} FP=${eFP} FN=${eFN} | accuracy=${eAcc.toFixed(3)} precision=${ePrec?.toFixed(3) ?? '—'} recall=${eRec?.toFixed(3) ?? '—'} F1=${eF1?.toFixed(3) ?? '—'}`);
  console.log('  false merges (dangerous):', merges.join(', ') || 'none');
  console.log('  false splits:', splits.join(', ') || 'none');

  console.log(`\nfrozen fingerprint: ${FINGERPRINT}`);
  console.log('results also written to .data/intel/dedupe-event-results.json');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    new URL('../../.data/intel/dedupe-event-results.json', import.meta.url),
    JSON.stringify({
      fingerprint: FINGERPRINT,
      dedupe: { cases: d.length, TP: dTP, TN: dTN, FP: dFP, FN: dFN, failures: d.filter((x) => !x.ok).map((x) => ({ id: x.id, expected: x.expectedDuplicate, actual: x.actual })) },
      events: { cases: e.length, pairs: eTotal, TP: eTP, TN: eTN, FP: eFP, FN: eFN, clusterCorrect: e.filter((x) => x.ok).length, failures: e.filter((x) => !x.ok).map((x) => ({ id: x.id, expected: x.expectedClusters, actual: x.actual })) },
      embedMode: vectorsByObservation ? 'semantic' : 'keyword-only'
    }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
