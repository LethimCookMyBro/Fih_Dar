import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentClerkUser } from '@/server/auth';
import { errorResponse } from '@/server/responses';
import { createReport } from '@/server/report-service';
import { parseReportFormData } from '@/server/report-validation';

export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentClerkUser();
    const form = await request.formData();
    const { metadata, image } = await parseReportFormData(form);
    const report = await createReport(context, metadata, image);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
