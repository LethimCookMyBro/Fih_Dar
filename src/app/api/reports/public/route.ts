import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/responses';
import { listPublicReports } from '@/server/report-service';

export async function GET() {
  try {
    return NextResponse.json({ reports: await listPublicReports() });
  } catch (error) {
    return errorResponse(error);
  }
}
