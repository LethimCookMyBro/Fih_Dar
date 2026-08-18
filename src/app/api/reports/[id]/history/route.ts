import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentClerkUser } from '@/server/auth';
import { errorResponse } from '@/server/responses';
import { getOperationalReportHistory } from '@/server/report-service';

/**
 * Officer-only evidence detail for one report: full field-action and
 * operational-decision history. Loaded on demand ("ดูหลักฐาน") — never
 * bundled into the paginated /reports/ops list response.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await context.params).id);
    const clerkContext = await requireCurrentClerkUser();
    const report = await getOperationalReportHistory(id, clerkContext);
    return NextResponse.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}
