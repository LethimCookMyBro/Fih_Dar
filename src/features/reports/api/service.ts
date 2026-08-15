import { apiClient } from '@/lib/api-client';

import type { CreatedReport, MyReports, Profile, ProfilePatch, Report } from './types';

/** Server error envelope produced by `src/server/responses.ts`. */
interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function postFormData<T>(endpoint: string, body: FormData): Promise<T> {
  // Deliberately not apiClient(): a multipart body must not carry a manual
  // Content-Type header or the boundary is lost.
  const res = await fetch(`/api${endpoint}`, { method: 'POST', body });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(parsed?.error?.message ?? `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getPublicReports(): Promise<{ reports: Report[] }> {
  return apiClient<{ reports: Report[] }>('/reports/public');
}

export function getMyReports(): Promise<MyReports> {
  return apiClient<MyReports>('/reports/me');
}

export function createReport(form: FormData): Promise<CreatedReport> {
  return postFormData<CreatedReport>('/reports', form);
}

export function getProfile(): Promise<{ profile: Profile }> {
  return apiClient<{ profile: Profile }>('/profile');
}

export function updateProfile(patch: ProfilePatch): Promise<{ profile: Profile }> {
  return apiClient<{ profile: Profile }>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
}
