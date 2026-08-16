import { NextRequest, NextResponse } from 'next/server';

import { getSourceBySlug } from '@/server/sources-service';
import { errorResponse } from '@/server/responses';

/** Public source detail for the observatory drawer. 404 when unknown. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const source = await getSourceBySlug(slug);
    if (!source) {
      return NextResponse.json({ error: 'source_not_found' }, { status: 404 });
    }
    return NextResponse.json(source);
  } catch (error) {
    return errorResponse(error);
  }
}
