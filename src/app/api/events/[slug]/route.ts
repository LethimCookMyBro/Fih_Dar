import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getPriorityAreaDetail } from '@/server/priority-service';
import { errorResponse } from '@/server/responses';

// Slugs are sha1 hex digests (scripts/intel/events.mjs#requireSlug).
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-f0-9]+$/, 'Invalid event slug');

/** Full evidence detail for one EventCandidate, loaded on demand
 * ("ดูหลักฐานทั้งหมด") — every member observation, not the small preview the
 * /api/events/priority list endpoint returns. Read-only, same as the list. */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const slug = slugSchema.parse((await context.params).slug);
    const result = await getPriorityAreaDetail(slug);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
