const THAI_NUMBER = new Intl.NumberFormat('th-TH');

export function formatNumber(value: number): string {
  return THAI_NUMBER.format(value);
}

const THAI_DATETIME = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const THAI_TIME = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

const THAI_CLOCK = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit'
});

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : THAI_DATETIME.format(date);
}

export function formatTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : THAI_TIME.format(date);
}

export function formatClock(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : THAI_CLOCK.format(date);
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return '—';
  return `${(durationMs / 1000).toFixed(1)} วิ`;
}

/** Thai label for a location precision level. */
export const PRECISION_LABELS: Record<string, string> = {
  EXACT: 'พิกัดที่ระบุ',
  WATERBODY: 'แหล่งน้ำ',
  SUBDISTRICT: 'ตำบล',
  DISTRICT: 'อำเภอ',
  PROVINCE: 'จังหวัด',
  UNKNOWN: 'ยังไม่ระบุ'
};
