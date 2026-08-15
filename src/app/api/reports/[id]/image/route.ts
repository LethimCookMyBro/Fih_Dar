import { NextResponse } from 'next/server';
import { z } from 'zod';

import { optionalCurrentClerkUserId } from '@/server/auth';
import { NotFoundError } from '@/server/errors';
import { errorResponse } from '@/server/responses';
import { getReportImageAccess } from '@/server/report-service';
import { readReportImage } from '@/server/storage';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await context.params).id);
    const report = await getReportImageAccess(id, await optionalCurrentClerkUserId());
    if (!report) throw new NotFoundError();
    const image = await readReportImage(report.imagePath);
    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': report.status === 'VERIFIED' ? 'public, max-age=300' : 'private, no-store'
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
