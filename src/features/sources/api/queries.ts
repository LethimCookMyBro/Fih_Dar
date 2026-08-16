import { queryOptions } from '@tanstack/react-query';

import {
  getSignalTrace,
  getSourceDetail,
  getSourceList,
  getSourceRuns,
  getSourcesSummary
} from './service';
import type { SourceListSort } from './types';

export const sourcesKeys = {
  all: ['sources'] as const,
  summary: () => [...sourcesKeys.all, 'summary'] as const,
  list: (params: unknown) => [...sourcesKeys.all, 'list', params] as const,
  detail: (slug: string) => [...sourcesKeys.all, 'detail', slug] as const,
  runs: (params: unknown) => [...sourcesKeys.all, 'runs', params] as const,
  trace: () => [...sourcesKeys.all, 'trace'] as const
};

/** Fresh enough — the pipeline refreshes on a ~6h schedule; a page load is plenty. */
const STALE_TIME = 60_000;

export const sourcesSummaryQueryOptions = () =>
  queryOptions({
    queryKey: sourcesKeys.summary(),
    queryFn: getSourcesSummary,
    staleTime: STALE_TIME
  });

export const sourceListQueryOptions = (params: {
  q?: string;
  status?: string;
  category?: string;
  transport?: string;
  sort?: SourceListSort;
  page?: number;
  pageSize?: number;
}) =>
  queryOptions({
    queryKey: sourcesKeys.list(params),
    queryFn: () => getSourceList(params),
    staleTime: STALE_TIME
  });

export const sourceDetailQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: sourcesKeys.detail(slug),
    queryFn: () => getSourceDetail(slug),
    staleTime: STALE_TIME
  });

export const sourceRunsQueryOptions = (params: {
  page?: number;
  pageSize?: number;
  status?: string;
}) =>
  queryOptions({
    queryKey: sourcesKeys.runs(params),
    queryFn: () => getSourceRuns(params),
    staleTime: STALE_TIME
  });

export const signalTraceQueryOptions = () =>
  queryOptions({
    queryKey: sourcesKeys.trace(),
    queryFn: getSignalTrace,
    staleTime: 5 * 60_000
  });
