import { apiClient } from '@/lib/api-client';

import type { PriorityResponse } from './types';

export function getPriorityAreas(): Promise<PriorityResponse> {
  return apiClient<PriorityResponse>('/events/priority');
}
