import 'server-only';

import { auth, currentUser } from '@clerk/nextjs/server';

import { AuthServiceError, UnauthorizedError } from './errors';

export interface CurrentClerkUser {
  userId: string;
  orgId: string | null;
  user: Awaited<ReturnType<typeof currentUser>> & {};
}

export async function requireCurrentClerkUser(): Promise<CurrentClerkUser> {
  let userId: string | null;
  let orgId: string | null;

  try {
    const session = await auth();
    userId = session.userId;
    orgId = session.orgId ?? null;
  } catch {
    throw new AuthServiceError('Authentication service could not be reached');
  }

  if (!userId) throw new UnauthorizedError();

  try {
    const user = await currentUser();
    if (!user || user.id !== userId) {
      throw new AuthServiceError('Authenticated identity could not be read');
    }
    return { userId, orgId, user };
  } catch (error) {
    if (error instanceof AuthServiceError) throw error;
    throw new AuthServiceError('Authenticated identity could not be read');
  }
}

export async function optionalCurrentClerkUserId(): Promise<string | null> {
  try {
    return (await auth()).userId ?? null;
  } catch {
    return null;
  }
}
