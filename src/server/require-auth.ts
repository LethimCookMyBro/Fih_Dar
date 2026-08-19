import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { isOfficer, isPublicOpsDemoEnabled } from './authorization';

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
 * /ops page guard — server-side, never just a UI hide.
 *
 * Normally officer-only: signed-out visitors go to sign-in, signed-in
 * non-officers go back to the map. While PUBLIC_OPS_DEMO=true (pitch-day
 * read-only demo mode), anyone may render the page; the returned `isOfficer`
 * flag is what OpsView/PriorityLane use to hide write controls. This never
 * touches requireOfficer() — every mutation API stays officer-only either way.
 */
export async function requireOpsPageAccess(): Promise<{ isOfficer: boolean }> {
  const { userId } = await auth();
  const officer = userId ? isOfficer(userId) : false;

  if (isPublicOpsDemoEnabled()) return { isOfficer: officer };

  if (!userId) redirect(`/auth/sign-in?redirect_url=${encodeURIComponent('/ops')}`);
  if (!officer) redirect('/map');
  return { isOfficer: officer };
}
