import { NextResponse } from 'next/server';
import { z } from 'zod';

import { optionalCurrentClerkUserId } from '@/server/auth';
import { NotFoundError } from '@/server/errors';
import { errorResponse } from '@/server/responses';
import { getReportForViewer } from '@/server/report-service';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await context.params).id);
    const report = await getReportForViewer(id, await optionalCurrentClerkUserId());
    if (!report) throw new NotFoundError();
    return NextResponse.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}
