import { apiClient } from '@/lib/api-client';

import type { SourcesSummary } from './types';

export function getSourcesSummary(): Promise<SourcesSummary> {
  return apiClient<SourcesSummary>('/sources/summary');
}
