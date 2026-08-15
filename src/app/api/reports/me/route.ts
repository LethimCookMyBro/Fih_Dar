import { NextResponse } from 'next/server';

import { requireCurrentClerkUser } from '@/server/auth';
import { errorResponse } from '@/server/responses';
import { listCurrentUserReports } from '@/server/report-service';

export async function GET() {
  try {
    return NextResponse.json(await listCurrentUserReports(await requireCurrentClerkUser()));
  } catch (error) {
    return errorResponse(error);
  }
}
