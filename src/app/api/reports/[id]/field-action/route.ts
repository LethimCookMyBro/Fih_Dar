import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentClerkUser } from '@/server/auth';
import { BadRequestError } from '@/server/errors';
import { errorResponse } from '@/server/responses';
import { recordFieldAction } from '@/server/report-service';

const fieldActionSchema = z
  .object({
    outcome: z.enum([
      'FOUND',
      'NOT_FOUND',
      'MISIDENTIFIED',
      'CONTROLLED',
      'FOLLOW_UP_REQUIRED',
      'ACCESS_DENIED'
    ]),
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
    const parsed = fieldActionSchema.parse(input);

    const result = await recordFieldAction(clerkContext, reportId, {
      outcome: parsed.outcome,
      notes: parsed.notes ?? null
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
