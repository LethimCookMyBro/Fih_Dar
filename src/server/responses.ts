import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { StorageValidationError } from './storage';
import { AppError } from './errors';

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }

  if (error instanceof StorageValidationError) {
    return NextResponse.json(
      { error: { code: 'INVALID_IMAGE', message: error.message } },
      { status: 400 }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: error.flatten().fieldErrors
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    { status: 500 }
  );
}
