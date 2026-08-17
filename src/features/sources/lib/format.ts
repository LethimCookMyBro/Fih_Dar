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

/**
 * Truthful data-signal caption, separate from the technical connection pill.
 * `status: 'OK'` only means the latest fetch/parse/upsert succeeded — it says
 * nothing about whether that source has ever produced a usable FihDar signal.
 * Returns null when the technical status itself already explains the state
 * (DEGRADED / UNKNOWN), so the caption never repeats or contradicts the pill.
 */
export function signalCaption(source: {
  status: string;
  totalObservations: number;
  relevantObservations: number;
  lastRunCreated: number | null;
}): string | null {
  if (source.status !== 'OK') return null;
  if (source.relevantObservations > 0) {
    return (source.lastRunCreated ?? 0) > 0 ? 'พบสัญญาณใหม่ในรอบล่าสุด' : 'ไม่มีสัญญาณใหม่ในรอบล่าสุด';
  }
  return source.totalObservations === 0 ? 'ยังไม่เคยพบข้อมูลจากแหล่งนี้' : 'ยังไม่มีสัญญาณที่เกี่ยวข้อง';
}
