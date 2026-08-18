// Zero-dependency officer allowlist helpers — no relative imports, so the
// deterministic node self-test can import this file directly under
// --experimental-strip-types (which cannot resolve extensionless imports).
export function officerAllowlist(): string[] {
  const raw = process.env.OFFICER_CLERK_USER_IDS ?? '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isOfficer(clerkUserId: string): boolean {
  return officerAllowlist().includes(clerkUserId);
}
