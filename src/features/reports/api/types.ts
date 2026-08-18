// Client-side mirror of the server constants. Keep in sync with
// src/server/report-validation.ts (provinces/precision) and the Prisma enums
// (ReportStatus / FieldOutcome) — the server remains the enforcement point.

export const EEC_PILOT_PROVINCES = ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง'] as const;

export const REPORT_PROVINCES = [
  'กระบี่',
  'กรุงเทพมหานคร',
  'กาญจนบุรี',
  'กาฬสินธุ์',
  'กำแพงเพชร',
  'ขอนแก่น',
  'จันทบุรี',
  'ฉะเชิงเทรา',
  'ชลบุรี',
  'ชัยนาท',
  'ชัยภูมิ',
  'ชุมพร',
  'ตรัง',
  'ตราด',
  'ตาก',
  'นครนายก',
  'นครปฐม',
  'นครพนม',
  'นครราชสีมา',
  'นครศรีธรรมราช',
  'นครสวรรค์',
  'นนทบุรี',
  'นราธิวาส',
  'น่าน',
  'บึงกาฬ',
  'บุรีรัมย์',
  'ปทุมธานี',
  'ประจวบคีรีขันธ์',
  'ปราจีนบุรี',
  'ปัตตานี',
  'พระนครศรีอยุธยา',
  'พะเยา',
  'พังงา',
  'พัทลุง',
  'พิจิตร',
  'พิษณุโลก',
  'ภูเก็ต',
  'มหาสารคาม',
  'มุกดาหาร',
  'ยะลา',
  'ยโสธร',
  'ระนอง',
  'ระยอง',
  'ราชบุรี',
  'ร้อยเอ็ด',
  'ลพบุรี',
  'ลำปาง',
  'ลำพูน',
  'ศรีสะเกษ',
  'สกลนคร',
  'สงขลา',
  'สตูล',
  'สมุทรปราการ',
  'สมุทรสงคราม',
  'สมุทรสาคร',
  'สระบุรี',
  'สระแก้ว',
  'สิงห์บุรี',
  'สุพรรณบุรี',
  'สุราษฎร์ธานี',
  'สุรินทร์',
  'สุโขทัย',
  'หนองคาย',
  'หนองบัวลำภู',
  'อำนาจเจริญ',
  'อุดรธานี',
  'อุตรดิตถ์',
  'อุทัยธานี',
  'อุบลราชธานี',
  'อ่างทอง',
  'เชียงราย',
  'เชียงใหม่',
  'เพชรบุรี',
  'เพชรบูรณ์',
  'เลย',
  'แพร่',
  'แม่ฮ่องสอน'
] as const;
export type ReportProvince = (typeof REPORT_PROVINCES)[number];

export const REPORT_STATUSES = [
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'FIELD_CHECKED',
  'FIELD_CONFIRMED',
  'ACTION_TAKEN',
  'MONITORING',
  'REASSESSMENT'
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const LOCATION_PRECISIONS = [
  'EXACT',
  'WATERBODY',
  'SUBDISTRICT',
  'DISTRICT',
  'PROVINCE',
  'UNKNOWN'
] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const PHOTO_LOCATION_RELATIONS = ['SAME', 'DIFFERENT', 'UNKNOWN'] as const;
export type PhotoLocationRelation = (typeof PHOTO_LOCATION_RELATIONS)[number];

export const LOCATION_PRECISION_LABELS: Record<LocationPrecision, string> = {
  EXACT: 'ตำแหน่งที่แน่ชัด',
  WATERBODY: 'บริเวณแหล่งน้ำ (ไม่ทราบจุดที่แน่ชัด)',
  SUBDISTRICT: 'ระดับตำบล',
  DISTRICT: 'ระดับอำเภอ',
  PROVINCE: 'ระดับจังหวัด',
  UNKNOWN: 'ไม่แน่ใจ'
};

export const LOCATION_PRECISION_DESCRIPTIONS: Record<LocationPrecision, string> = {
  EXACT: 'ปักหมุดตรงจุดที่พบปลาจริง',
  WATERBODY: 'ทราบแหล่งน้ำ เช่น คลอง/แม่น้ำ/บ่อ แต่ไม่ทราบจุดที่แน่ชัด',
  SUBDISTRICT: 'ทราบเพียงระดับตำบล',
  DISTRICT: 'ทราบเพียงระดับอำเภอ',
  PROVINCE: 'ทราบเพียงจังหวัด',
  UNKNOWN: 'ไม่แน่ใจในตำแหน่ง — พิกัดที่ปักคือจุดโดยประมาณเท่านั้น'
};

export const PHOTO_LOCATION_RELATION_LABELS: Record<PhotoLocationRelation, string> = {
  SAME: 'ถ่าย ณ จุดพบปลา',
  DIFFERENT: 'ถ่ายที่อื่น ไม่ใช่จุดพบปลา',
  UNKNOWN: 'ไม่ทราบความสัมพันธ์ (ข้อมูลเก่า)'
};

export const PHOTO_LOCATION_RELATION_DESCRIPTIONS: Record<PhotoLocationRelation, string> = {
  SAME: 'รูปนี้ถ่ายที่จุดพบปลาจริง',
  DIFFERENT: 'เช่น ถ่ายรูปที่บ้านหลังจากจับปลามาจากที่อื่น — พิกัดที่ปักไว้คือตำแหน่งที่พบปลาจริง',
  UNKNOWN: 'ข้อมูลนี้ไม่ได้ถูกบันทึกในยุคก่อนหน้า — ไม่สามารถระบุได้'
};

export const REPORT_QUANTITY_RANGES = [
  'ONE',
  'TWO_TO_FIVE',
  'SIX_TO_TEN',
  'OVER_TEN',
  'UNKNOWN'
] as const;
export type ReportQuantityRange = (typeof REPORT_QUANTITY_RANGES)[number];

export const REPORT_QUANTITY_RANGE_LABELS: Record<ReportQuantityRange, string> = {
  ONE: '1 ตัว',
  TWO_TO_FIVE: '2–5 ตัว',
  SIX_TO_TEN: '6–10 ตัว',
  OVER_TEN: 'มากกว่า 10 ตัว',
  UNKNOWN: 'ไม่แน่ใจ'
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'กำลังตรวจสอบ',
  VERIFIED: 'ยืนยันแล้ว',
  REJECTED: 'ไม่ผ่านการตรวจสอบ',
  FIELD_CHECKED: 'ตรวจสอบพื้นที่แล้ว',
  FIELD_CONFIRMED: 'ยืนยันจากพื้นที่แล้ว',
  ACTION_TAKEN: 'ดำเนินการควบคุมแล้ว',
  MONITORING: 'เฝ้าระวังต่อ',
  REASSESSMENT: 'ต้องประเมินซ้ำ'
};

export const FIELD_OUTCOMES = [
  'FOUND',
  'NOT_FOUND',
  'MISIDENTIFIED',
  'CONTROLLED',
  'FOLLOW_UP_REQUIRED',
  'ACCESS_DENIED'
] as const;
export type FieldOutcome = (typeof FIELD_OUTCOMES)[number];

export const FIELD_OUTCOME_LABELS: Record<FieldOutcome, string> = {
  FOUND: 'พบปลาหมอคางดำจริง',
  NOT_FOUND: 'ไม่พบเมื่อสำรวจ',
  MISIDENTIFIED: 'ระบุชนิดผิด / รายงานไม่ยืนยัน',
  CONTROLLED: 'ดำเนินการควบคุมแล้ว',
  FOLLOW_UP_REQUIRED: 'ต้องติดตามซ้ำ',
  ACCESS_DENIED: 'ไม่สามารถเข้าพื้นที่ได้'
};

export interface FieldActionSummary {
  id: string;
  outcome: FieldOutcome;
  notes: string | null;
  createdAt: string;
  officerName: string;
}

// PRE-FIELD operational triage decision — distinct from FieldOutcome, which
// is recorded only after an actual field visit.
export const OPERATIONAL_DECISIONS = ['DISPATCH', 'MONITOR', 'DEFER'] as const;
export type OperationalDecisionType = (typeof OPERATIONAL_DECISIONS)[number];

export const OPERATIONAL_DECISION_LABELS: Record<OperationalDecisionType, string> = {
  DISPATCH: 'ส่งทีมลงพื้นที่',
  MONITOR: 'เฝ้าระวังก่อน',
  DEFER: 'ยังไม่ดำเนินการ'
};

export interface DecisionSummary {
  id: string;
  decision: OperationalDecisionType;
  reason: string | null;
  previousDecision: OperationalDecisionType | null;
  createdAt: string;
  officerName: string;
}

/**
 * Shape returned by every reports endpoint. Public responses round the
 * coordinates to 3 decimals server-side (~110 m) so a home location is never
 * published exactly; `/api/reports/me` returns the owner's exact values.
 */
export interface Report {
  id: string;
  publicReference: string;
  latitude: number;
  longitude: number;
  province: string;
  district: string | null;
  observedAt: string;
  quantityRange: ReportQuantityRange;
  status: ReportStatus;
  locationPrecision: LocationPrecision;
  // Three-state photo-location relationship (SAME/DIFFERENT/UNKNOWN).
  // Historical records are UNKNOWN — they never declared this relationship.
  photoLocationRelation: PhotoLocationRelation;
  // Legacy boolean for backward compatibility (DIFFERENT -> true, SAME/UNKNOWN -> false)
  photoTakenElsewhere: boolean;
  createdAt: string;
  isSeedData?: boolean;
  // Nationwide intake vs. the current EEC field-operation pilot scope. Never
  // used to hide a report — only to label it truthfully.
  isEecPilot?: boolean;
  imageUrl?: string;
  latestFieldAction?: FieldActionSummary | null;
}

export interface MyReports {
  reports: Report[];
  counts: { total: number } & Record<ReportStatus, number>;
}

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  organization: string | null;
  province: string | null;
  avatarUrl: string | null;
}

export interface CreatedReport {
  id: string;
  publicReference: string;
  status: ReportStatus;
}

export interface ProfilePatch {
  displayName?: string;
  phone?: string | null;
  organization?: string | null;
  province?: ReportProvince | null;
}
