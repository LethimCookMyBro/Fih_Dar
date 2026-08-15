export const REPORT_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_PROVINCES = ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง'] as const;
export type ReportProvince = (typeof REPORT_PROVINCES)[number];

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
  REJECTED: 'ไม่ผ่านการตรวจสอบ'
};

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
  imageUrl?: string;
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
