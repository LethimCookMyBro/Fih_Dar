import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireCurrentClerkUser } from '@/server/auth';
import { BadRequestError } from '@/server/errors';
import { errorResponse } from '@/server/responses';
import { getEventDecisionHistory, recordEventDecision } from '@/server/event-decision-service';

const decisionSchema = z
  .object({
    decision: z.enum(['DISPATCH', 'MONITOR', 'DEFER']),
    reason: z.string().trim().max(1000).nullable().optional()
  })
  .strict();

// Slugs are sha1 hex digests (scripts/intel/events.mjs#requireSlug) — not a
// UUID, so validated as a bounded hex string rather than z.uuid().
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-f0-9]+$/, 'Invalid event slug');

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const slug = slugSchema.parse((await context.params).slug);
    const clerkContext = await requireCurrentClerkUser();

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new BadRequestError('Invalid JSON body');
    }
    const parsed = decisionSchema.parse(input);

    const result = await recordEventDecision(clerkContext, slug, {
      decision: parsed.decision,
      reason: parsed.reason ?? null
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const slug = slugSchema.parse((await context.params).slug);
    const clerkContext = await requireCurrentClerkUser();
    const result = await getEventDecisionHistory(clerkContext, slug);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
