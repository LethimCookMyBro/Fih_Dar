// Field-operation authorization. Officers are an explicit allowlist of Clerk
// user ids — there is no separate citizen/officer role table, and the check is
// always enforced server-side, never only in the UI.
import { ForbiddenError } from './errors';
import { isOfficer } from './officer-allowlist';

export { isOfficer, officerAllowlist } from './officer-allowlist';

export function requireOfficer(clerkUserId: string): void {
  if (!isOfficer(clerkUserId)) throw new ForbiddenError();
}

/**
 * Pitch-day/demo toggle — read access ONLY. When enabled, /ops renders for
 * anyone (see requireOpsPageAccess in require-auth.ts); it never affects
 * requireOfficer(), so every mutation stays officer-only regardless of this
 * flag. Disable by unsetting PUBLIC_OPS_DEMO in the deployment environment.
 */
export function isPublicOpsDemoEnabled(): boolean {
  return process.env.PUBLIC_OPS_DEMO === 'true';
}
