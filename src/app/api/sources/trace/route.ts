import { NextResponse } from 'next/server';

import { getSignalTrace } from '@/server/sources-service';
import { errorResponse } from '@/server/responses';

/**
 * A REAL signal trace — a recent, relevant observation selected from the
 * database with its species/relevance/location/dedupe/event/priority trail.
 * Never fabricated; 404 when no processed relevant signal exists yet.
 */
export async function GET() {
  try {
    const trace = await getSignalTrace();
    if (!trace) {
      return NextResponse.json({ error: 'no_signal_yet' }, { status: 404 });
    }
    return NextResponse.json(trace);
  } catch (error) {
    return errorResponse(error);
  }
}
