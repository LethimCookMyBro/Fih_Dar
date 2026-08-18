import { apiClient } from '@/lib/api-client';

import type {
  CreatedReport,
  DecisionSummary,
  FieldActionSummary,
  MyReports,
  OperationalDecisionType,
  Profile,
  ProfilePatch,
  Report,
  ReportStatus
} from './types';

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

export function getProfile(): Promise<{ profile: Profile; isOfficer: boolean }> {
  return apiClient<{ profile: Profile; isOfficer: boolean }>('/profile');
}

export function updateProfile(patch: ProfilePatch): Promise<{ profile: Profile }> {
  return apiClient<{ profile: Profile }>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
}

// --- Officer field operations ------------------------------------------------

export interface OperationalReport extends Report {
  note: string | null;
  reporterName: string;
  operationalDecision: OperationalDecisionType | null;
  latestFieldAction: FieldActionSummary | null;
}

export interface OperationalReportHistory extends OperationalReport {
  fieldActions: FieldActionSummary[];
  decisions: DecisionSummary[];
}

export interface OperationalReportsPage {
  reports: OperationalReport[];
  nextCursor: string | null;
  counts: { total: number } & Record<ReportStatus, number>;
}

export interface OperationalReportsQuery {
  cursor?: string;
  limit?: number;
  status?: ReportStatus;
  scope?: 'EEC' | 'ALL';
}

export function getOperationalReports(
  query: OperationalReportsQuery = {}
): Promise<OperationalReportsPage> {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.status) params.set('status', query.status);
  if (query.scope) params.set('scope', query.scope);
  const qs = params.toString();
  return apiClient<OperationalReportsPage>(`/reports/ops${qs ? `?${qs}` : ''}`);
}

export function getOperationalReportHistory(reportId: string): Promise<OperationalReportHistory> {
  return apiClient<OperationalReportHistory>(`/reports/${reportId}/history`);
}

export function recordFieldAction(
  reportId: string,
  input: { outcome: string; notes: string | null }
): Promise<{ fieldAction: FieldActionSummary; status: ReportStatus }> {
  return apiClient(`/reports/${reportId}/field-action`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function reopenForReassessment(
  reportId: string,
  notes: string | null
): Promise<{ status: ReportStatus }> {
  return apiClient(`/reports/${reportId}/reassess`, {
    method: 'POST',
    body: JSON.stringify({ notes })
  });
}

export function recordOperationalDecision(
  reportId: string,
  input: { decision: OperationalDecisionType; reason: string | null }
): Promise<{ decision: DecisionSummary }> {
  return apiClient(`/reports/${reportId}/decision`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
