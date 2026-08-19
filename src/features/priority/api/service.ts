import { apiClient } from '@/lib/api-client';
import type { DecisionSummary, OperationalDecisionType } from '@/features/reports/api/types';

import type { PriorityAreaDetail, PriorityResponse } from './types';

export interface PriorityAreasQuery {
  cursor?: string;
  limit?: number;
  /** 'EEC' restricts to the field-operation pilot provinces; 'ALL' (default) is nationwide. */
  scope?: 'EEC' | 'ALL';
}

export function getPriorityAreas(query: PriorityAreasQuery = {}): Promise<PriorityResponse> {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.scope) params.set('scope', query.scope);
  const qs = params.toString();
  return apiClient<PriorityResponse>(`/events/priority${qs ? `?${qs}` : ''}`);
}

/** Full evidence for one event, loaded on demand ("ดูหลักฐานทั้งหมด"). */
export function getPriorityAreaDetail(slug: string): Promise<PriorityAreaDetail> {
  return apiClient<PriorityAreaDetail>(`/events/${encodeURIComponent(slug)}`);
}

export function recordEventDecision(
  slug: string,
  input: { decision: OperationalDecisionType; reason: string | null }
): Promise<{ decision: DecisionSummary }> {
  return apiClient<{ decision: DecisionSummary }>(`/events/${encodeURIComponent(slug)}/decision`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function getEventDecisionHistory(slug: string): Promise<{ decisions: DecisionSummary[] }> {
  return apiClient<{ decisions: DecisionSummary[] }>(
    `/events/${encodeURIComponent(slug)}/decision`
  );
}
