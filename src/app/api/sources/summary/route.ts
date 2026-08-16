import { NextResponse } from 'next/server';

import { getSourcesSummary } from '@/server/sources-service';
import { errorResponse } from '@/server/responses';

/** Public, read-only: source/pipeline status from real DB values. No mutation, no run trigger. */
export async function GET() {
  try {
    const summary = await getSourcesSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return errorResponse(error);
  }
}
