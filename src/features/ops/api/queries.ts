import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import {
  getOperationalReportHistory,
  getOperationalReports,
  type OperationalReportsQuery
} from '@/features/reports/api/service';
import { getPriorityAreas } from '@/features/priority/api/service';

const OPS_PRIORITY_LANE_LIMIT = 15;

export const opsKeys = {
  all: ['ops'] as const,
  reports: (filters: Omit<OperationalReportsQuery, 'cursor'>) =>
    [...opsKeys.all, 'reports', filters] as const,
  history: (reportId: string) => [...opsKeys.all, 'history', reportId] as const,
  priorityAreas: () => [...opsKeys.all, 'priority-areas', OPS_PRIORITY_LANE_LIMIT] as const
};

/** Paginated (25–50/page) — never the whole queue in one request. */
export const operationalReportsQueryOptions = (filters: Omit<OperationalReportsQuery, 'cursor'>) =>
  infiniteQueryOptions({
    queryKey: opsKeys.reports(filters),
    queryFn: ({ pageParam }) => getOperationalReports({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

/** Full field-action + decision history for one report — loaded on demand ("ดูหลักฐาน"). */
export const operationalReportHistoryQueryOptions = (reportId: string) =>
  queryOptions({
    queryKey: opsKeys.history(reportId),
    queryFn: () => getOperationalReportHistory(reportId),
    enabled: Boolean(reportId)
  });

/** Read-only intelligence-derived priority ranking (EventCandidate) — a
 * separate evidence lane from citizen reports. Bounded to exactly what the
 * /ops lane renders (see priority-lane.tsx) — a real DB-ordered top-N query,
 * not a client-side slice of a larger fetch. */
export const priorityAreasQueryOptions = () =>
  queryOptions({
    queryKey: opsKeys.priorityAreas(),
    queryFn: () => getPriorityAreas({ limit: OPS_PRIORITY_LANE_LIMIT })
  });
