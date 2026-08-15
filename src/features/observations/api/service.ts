import { apiClient } from '@/lib/api-client';

import type { ExternalObservation } from './types';

export function getPublicObservations(): Promise<{ observations: ExternalObservation[] }> {
  return apiClient<{ observations: ExternalObservation[] }>('/observations/public');
}
