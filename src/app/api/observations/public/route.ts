import { NextResponse } from 'next/server';

import { listPublicObservations } from '@/server/observation-service';

/** Read-only: external observations ingested from public sources. */
export async function GET() {
  const observations = await listPublicObservations();
  return NextResponse.json({ observations });
}
