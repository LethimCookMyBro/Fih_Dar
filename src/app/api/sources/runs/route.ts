import { NextRequest, NextResponse } from 'next/server';

import { getSourceRuns } from '@/server/sources-service';
import { errorResponse } from '@/server/responses';

/**
 * Public, read-only, bounded run history. The UI only requests one page —
 * the endpoint never returns the full history, so it stays fast from 10 to
 * 1,000,000 runs.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const result = await getSourceRuns({
      page: params.get('page') ? Number(params.get('page')) : undefined,
      pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
      status: params.get('status') ?? undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
