import { NextResponse } from 'next/server';

import { requireCurrentClerkUser } from '@/server/auth';
import { BadRequestError } from '@/server/errors';
import { errorResponse } from '@/server/responses';
import { getCurrentProfile, updateCurrentProfile } from '@/server/profile-service';

export async function GET() {
  try {
    const context = await requireCurrentClerkUser();
    return NextResponse.json(await getCurrentProfile(context));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireCurrentClerkUser();
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new BadRequestError('Invalid JSON body');
    }
    return NextResponse.json({ profile: await updateCurrentProfile(input, context) });
  } catch (error) {
    return errorResponse(error);
  }
}
