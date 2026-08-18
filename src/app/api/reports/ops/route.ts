import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentClerkUser } from '@/server/auth';
import { errorResponse } from '@/server/responses';
import { listOperationalReports } from '@/server/report-service';

const REPORT_STATUSES = [
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'FIELD_CHECKED',
  'FIELD_CONFIRMED',
  'ACTION_TAKEN',
  'MONITORING',
  'REASSESSMENT'
] as const;

const querySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(REPORT_STATUSES).optional(),
  scope: z.enum(['EEC', 'ALL']).optional()
});

export async function GET(request: Request) {
  try {
    const context = await requireCurrentClerkUser();
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      scope: searchParams.get('scope') ?? undefined
    });
    const result = await listOperationalReports(context, query);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
