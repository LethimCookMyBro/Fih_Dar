import { queryOptions } from '@tanstack/react-query';

import { getSourcesSummary } from './service';

export const sourcesKeys = {
  all: ['sources'] as const,
  summary: () => [...sourcesKeys.all, 'summary'] as const
};

export const sourcesSummaryQueryOptions = () =>
  queryOptions({
    queryKey: sourcesKeys.summary(),
    queryFn: getSourcesSummary
  });
