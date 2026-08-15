const THAI_DATE = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

export function formatThaiDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : THAI_DATE.format(date);
}

/** `yyyy-mm-dd`, for `<input type='date'>` values. */
const pad = (value: number) => String(value).padStart(2, '0');

export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
