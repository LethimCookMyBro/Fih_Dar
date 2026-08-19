import { NextRequest, NextResponse } from 'next/server';

import { listPriorityAreas } from '@/server/priority-service';
import { errorResponse } from '@/server/responses';

/** Read-only: EXPERIMENTAL MVP operational priority ranking over resolved
 * event candidates. Bounded, DB-ordered by the persisted priority score —
 * see priority-service.ts. `?scope=EEC` restricts to the field-operation
 * pilot provinces; default is nationwide. `?limit=` caps the page size. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scopeParam = params.get('scope');
    const limitParam = params.get('limit');
    const cursorParam = params.get('cursor');

    const result = await listPriorityAreas({
      scope: scopeParam === 'EEC' ? 'EEC' : 'ALL',
      limit: limitParam ? Number(limitParam) : undefined,
      cursor: cursorParam ?? undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
