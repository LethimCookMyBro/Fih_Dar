import { expect, test } from '@playwright/test';

/**
 * PUBLIC_OPS_DEMO=true regression coverage — read access only.
 *
 * These only run meaningfully against a server actually started with
 * PUBLIC_OPS_DEMO=true (see CLAUDE.md/README for the flag); against the
 * normal dev server (flag unset) they skip, since the assertions here are
 * the opposite of e2e/ops-and-report.spec.ts's "unauthenticated user is
 * redirected away from /ops" — that file is the PUBLIC_OPS_DEMO=false
 * (default) regression coverage.
 */

test.describe('/ops — public read-only demo mode (PUBLIC_OPS_DEMO=true)', () => {
  test.skip(
    process.env.PUBLIC_OPS_DEMO !== 'true',
    'requires a server started with PUBLIC_OPS_DEMO=true'
  );

  test('unauthenticated visitor can load /ops read-only, without redirect', async ({ page }) => {
    const response = await page.goto('/ops');
    expect(response?.status()).toBeLessThan(400);
    expect(page.url()).toContain('/ops');

    // Demo notice visible; officer write controls (DISPATCH/MONITOR/DEFER) are not.
    await expect(page.getByText('โหมดสาธิต')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ส่งทีมลงพื้นที่' })).toHaveCount(0);
  });

  test('ops nav item is visible even when signed out during the demo', async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: 'ศูนย์ปฏิบัติการ' })).toBeVisible();
  });

  test('anonymous mutation attempts are still rejected during the demo', async ({ request }) => {
    const response = await request.post('/api/events/some-slug/decision', {
      data: { decision: 'DISPATCH', reason: null }
    });
    expect([400, 401, 403]).toContain(response.status());
  });
});
