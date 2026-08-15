import { queryOptions } from '@tanstack/react-query';

import { getPublicObservations } from './service';

export const observationKeys = {
  all: ['observations'] as const,
  publicList: () => [...observationKeys.all, 'public'] as const
};

export const publicObservationsQueryOptions = () =>
  queryOptions({
    queryKey: observationKeys.publicList(),
    queryFn: getPublicObservations
  });
