import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentClerkUser } from '@/server/auth';
import { BadRequestError } from '@/server/errors';
import { errorResponse } from '@/server/responses';
import { reopenForReassessment } from '@/server/report-service';

const reassessSchema = z
  .object({
    notes: z.string().trim().max(1000).nullable().optional()
  })
  .strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const reportId = z.uuid().parse((await context.params).id);
    const clerkContext = await requireCurrentClerkUser();

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new BadRequestError('Invalid JSON body');
    }
    const parsed = reassessSchema.parse(input);

    const result = await reopenForReassessment(clerkContext, reportId, parsed.notes ?? null);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
