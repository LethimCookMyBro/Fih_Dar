import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentClerkUser } from '@/server/auth';
import { BadRequestError } from '@/server/errors';
import { errorResponse } from '@/server/responses';
import { recordOperationalDecision } from '@/server/report-service';

const decisionSchema = z
  .object({
    decision: z.enum(['DISPATCH', 'MONITOR', 'DEFER']),
    reason: z.string().trim().max(1000).nullable().optional()
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
    const parsed = decisionSchema.parse(input);

    const result = await recordOperationalDecision(clerkContext, reportId, {
      decision: parsed.decision,
      reason: parsed.reason ?? null
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
