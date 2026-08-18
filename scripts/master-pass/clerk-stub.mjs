// Test double for '@clerk/nextjs/server', used ONLY by the alias-loader when
// running scripts/master-pass/officer-workflow.test.mjs directly under Node.
// The real report-service.ts functions under test are always called with an
// explicit `context` object in this test, so these bodies are never actually
// invoked — they exist only so the module graph loads without pulling in
// Clerk's real Next.js-only SDK (which plain Node cannot resolve).
export async function auth() {
  throw new Error('clerk-stub: auth() should not be called when context is passed explicitly');
}

export async function currentUser() {
  throw new Error('clerk-stub: currentUser() should not be called when context is passed explicitly');
}
