import { apiClient } from '@/lib/api-client';

import type {
  SignalTrace,
  SourceDetail,
  SourceListResponse,
  SourceListSort,
  SourceRunsResponse,
  SourcesSummary
} from './types';

export function getSourcesSummary(): Promise<SourcesSummary> {
  return apiClient<SourcesSummary>('/sources/summary');
}

export function getSourceList(params: {
  q?: string;
  status?: string;
  category?: string;
  transport?: string;
  sort?: SourceListSort;
  page?: number;
  pageSize?: number;
}): Promise<SourceListResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.category) search.set('category', params.category);
  if (params.transport) search.set('transport', params.transport);
  if (params.sort && params.sort !== 'name') search.set('sort', params.sort);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const query = search.toString();
  return apiClient<SourceListResponse>(`/sources${query ? `?${query}` : ''}`);
}

export function getSourceDetail(slug: string): Promise<SourceDetail> {
  return apiClient<SourceDetail>(`/sources/${encodeURIComponent(slug)}`);
}

export function getSourceRuns(params: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<SourceRunsResponse> {
  const search = new URLSearchParams();
  if (params.page && params.page > 1) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.status) search.set('status', params.status);
  const query = search.toString();
  return apiClient<SourceRunsResponse>(`/sources/runs${query ? `?${query}` : ''}`);
}

export function getSignalTrace(): Promise<SignalTrace | null> {
  return apiClient<SignalTrace>(`/sources/trace`).catch((error: unknown) => {
    // 404 means "no processed relevant signal yet" — the section renders an
    // empty state rather than failing the whole page.
    if (error instanceof Error && error.message.includes('404')) return null;
    throw error;
  });
}
