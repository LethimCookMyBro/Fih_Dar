export interface MapFilters {
  provinces: string[];
  days: string;
}

/**
 * One authoritative province+time check, shared by every map dataset
 * (reports, events, observations, priority panel) so a filter can never
 * apply to one layer while silently missing another.
 *
 * `provinces: []` means "all provinces" — never introduce a mixed state
 * like `['all', 'ชลบุรี']`.
 *
 * A dataset with no timestamp is excluded once a time filter is active —
 * there is no honest way to say it falls inside a range we can't read.
 */
export function matchesMapFilters(
  filters: MapFilters,
  province: string | null,
  timestamp: string | null
): boolean {
  if (filters.provinces.length > 0 && (!province || !filters.provinces.includes(province))) {
    return false;
  }
  if (filters.days === 'all') return true;
  if (!timestamp) return false;
  const cutoff = Date.now() - Number(filters.days) * 24 * 60 * 60 * 1000;
  return new Date(timestamp).getTime() >= cutoff;
}
