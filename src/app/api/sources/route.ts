import { NextRequest, NextResponse } from 'next/server';

import { getSourceList } from '@/server/sources-service';
import { errorResponse } from '@/server/responses';

/**
 * Public, read-only, paginated source registry with search / filter / sort.
 * Designed to stay bounded with 2 sources or 1,000+ — the browser only ever
 * receives one page of sanitized metadata. No secrets, no fetch config.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const result = await getSourceList({
      q: params.get('q') ?? undefined,
      status: params.get('status') ?? undefined,
      category: params.get('category') ?? undefined,
      transport: params.get('transport') ?? undefined,
      sort: params.get('sort') ?? undefined,
      page: params.get('page') ? Number(params.get('page')) : undefined,
      pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
