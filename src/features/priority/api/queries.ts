import { queryOptions } from '@tanstack/react-query';

import { getPriorityAreas, type PriorityAreasQuery } from './service';

export const priorityKeys = {
  all: ['priority'] as const,
  list: (query: PriorityAreasQuery) => [...priorityKeys.all, 'list', query] as const
};

export const priorityAreasQueryOptions = (query: PriorityAreasQuery = {}) =>
  queryOptions({
    queryKey: priorityKeys.list(query),
    queryFn: () => getPriorityAreas(query)
  });
