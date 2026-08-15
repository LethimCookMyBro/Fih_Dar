import { NextResponse } from 'next/server';

import { listPriorityAreas } from '@/server/priority-service';
import { errorResponse } from '@/server/responses';

/** Read-only: EXPERIMENTAL MVP operational priority ranking over resolved event candidates. */
export async function GET() {
  try {
    const result = await listPriorityAreas();
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
