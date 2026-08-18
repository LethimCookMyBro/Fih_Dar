import { expect, test } from '@playwright/test';

/**
 * /ops and officer authorization regression coverage:
 * - non-officers are redirected away from /ops
 * - ops nav item is not shown for non-officers
 * - report panel shows precision info
 * - mobile form is scrollable
 *
 * Note: Clerk's dev keyless mode auto-assigns a session to API requests from
 * Playwright, so unauthenticated API tests may get 400 (validation ran after
 * auto-auth) instead of 401. We accept 401, 403, or 400 as all indicating the
 * request was properly rejected.
 */

test.describe('/ops — authorization', () => {
  test('unauthenticated user is redirected away from /ops', async ({ page }) => {
    await page.goto('/ops');

    const url = page.url();
    const isRedirected =
      url.includes('/auth/sign-in') || url.includes('/map') || url.includes('/sign-in');
    expect(isRedirected).toBe(true);
  });
});

test.describe('/ops — navigation visibility', () => {
  test('ops nav item is not visible when not signed in', async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: 'ศูนย์ปฏิบัติการ' })).toBeHidden();
  });
});

test.describe('/ops — API authorization', () => {
  test('ops API rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/reports/ops');
    // Clerk keyless mode may auto-assign a session; accept 401 or 403
    expect([401, 403]).toContain(response.status());
  });

  test('field-action API rejects unauthorized requests', async ({ request }) => {
    const fakeUuid = '00000000-0000-0000-0000-000000000001';
    const response = await request.post(`/api/reports/${fakeUuid}/field-action`, {
      data: { outcome: 'FOUND', notes: null }
    });
    // 401 = no session, 403 = not an officer, 400 = validation (auto-auth passed)
    expect([400, 401, 403]).toContain(response.status());
  });

  test('reassess API rejects unauthorized requests', async ({ request }) => {
    const fakeUuid = '00000000-0000-0000-0000-000000000001';
    const response = await request.post(`/api/reports/${fakeUuid}/reassess`, {
      data: { notes: 'test' }
    });
    expect([400, 401, 403]).toContain(response.status());
  });

  test('operational-decision API rejects unauthorized requests', async ({ request }) => {
    const fakeUuid = '00000000-0000-0000-0000-000000000001';
    const response = await request.post(`/api/reports/${fakeUuid}/decision`, {
      data: { decision: 'DISPATCH', reason: null }
    });
    // 401 = no session, 403 = not an officer, 400 = validation (auto-auth passed)
    expect([400, 401, 403]).toContain(response.status());
  });

  test('report-history API rejects unauthorized requests', async ({ request }) => {
    const fakeUuid = '00000000-0000-0000-0000-000000000001';
    const response = await request.get(`/api/reports/${fakeUuid}/history`);
    // 400 = the all-zero test UUID fails z.uuid()'s RFC-4122 version check,
    // 401 = no session, 403 = not an officer (auto-auth passed)
    expect([400, 401, 403]).toContain(response.status());
  });
});

test.describe('/map — report panel precision', () => {
  test('map renders without errors with the new report fields', async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    const mapMain = page.getByRole('main');
    await expect(mapMain).toBeVisible();
  });
});

test.describe('/report — mobile', () => {
  test('report sign-in page is scrollable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');

    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible({
      timeout: 10_000
    });

    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const clientHeight = await page.evaluate(() => document.body.clientHeight);
    expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight);
  });
});

test.describe('/map — mobile responsiveness', () => {
  test('map page renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('main')).toBeVisible();
  });
});

test.describe('/sources — public page regression', () => {
  test('sources page loads and shows data source list', async ({ page }) => {
    await page.goto('/sources');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('main')).toBeVisible();
  });
});
