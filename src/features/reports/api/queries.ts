import { queryOptions } from '@tanstack/react-query';

import { getMyReports, getProfile, getPublicReports } from './service';

export const reportKeys = {
  all: ['reports'] as const,
  publicList: () => [...reportKeys.all, 'public'] as const,
  mine: () => [...reportKeys.all, 'me'] as const
};

export const profileKeys = {
  all: ['profile'] as const,
  current: () => [...profileKeys.all, 'current'] as const
};

export const publicReportsQueryOptions = () =>
  queryOptions({
    queryKey: reportKeys.publicList(),
    queryFn: getPublicReports
  });

export const myReportsQueryOptions = () =>
  queryOptions({
    queryKey: reportKeys.mine(),
    queryFn: getMyReports
  });

export const profileQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.current(),
    queryFn: getProfile
  });
