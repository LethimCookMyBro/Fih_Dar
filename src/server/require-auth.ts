import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { isOfficer } from './authorization';

/**
 * Page-level guard. Sends a signed-out visitor to sign-in and brings them back
 * to where they were headed, so "แจ้งการพบ" → sign in → /report.
 */
export async function requireAuthOrRedirect(returnTo: string): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect(`/auth/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  return userId;
}

/**
 * Officer page guard — server-side, never just a UI hide. Signed-out visitors
 * go to sign-in; signed-in non-officers go back to the map.
 */
export async function requireOfficerOrRedirect(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect(`/auth/sign-in?redirect_url=${encodeURIComponent('/ops')}`);
  if (!isOfficer(userId)) redirect('/map');
  return userId;
}
