// Field-operation authorization. Officers are an explicit allowlist of Clerk
// user ids — there is no separate citizen/officer role table, and the check is
// always enforced server-side, never only in the UI.
import { ForbiddenError } from './errors';
import { isOfficer } from './officer-allowlist';

export { isOfficer, officerAllowlist } from './officer-allowlist';

export function requireOfficer(clerkUserId: string): void {
  if (!isOfficer(clerkUserId)) throw new ForbiddenError();
}
