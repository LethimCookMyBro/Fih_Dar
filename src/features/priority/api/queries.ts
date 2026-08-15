import { queryOptions } from '@tanstack/react-query';

import { getPriorityAreas } from './service';

export const priorityKeys = {
  all: ['priority'] as const,
  list: () => [...priorityKeys.all, 'list'] as const
};

export const priorityAreasQueryOptions = () =>
  queryOptions({
    queryKey: priorityKeys.list(),
    queryFn: getPriorityAreas
  });
