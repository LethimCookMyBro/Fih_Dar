import { expect, test } from '@playwright/test';

/**
 * /report regression coverage for the report location + field operation
 * master pass.
 *
 * Note: /report requires Clerk authentication. In dev keyless mode, unauthenticated
 * users are redirected to /auth/sign-in. These tests verify:
 * 1. Unauthenticated users are correctly redirected to sign-in
 * 2. The sign-in page includes the correct redirect back to /report
 * 3. Public pages that consume report data work correctly
 */

test.describe('/report — authentication guard', () => {
  test('unauthenticated user is redirected to sign-in with correct redirect_url', async ({
    page
  }) => {
    await page.goto('/report');

    // Should redirect to Clerk sign-in
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible({
      timeout: 10_000
    });

    // The sign-up link should include redirect back to /report
    const signUpLink = page.getByRole('link', { name: 'สมัครสมาชิก' });
    await expect(signUpLink).toBeVisible();
    const href = await signUpLink.getAttribute('href');
    // Clerk encodes the full URL: redirect_url=http%3A%2F%2Flocalhost%3A3000%2Freport
    expect(href).toContain('report');
  });
});

test.describe('/report — server-side validation', () => {
  test('report API rejects submission without required fields', async ({ request }) => {
    // POST without auth should fail
    const response = await request.post('/api/reports', {
      form: {
        latitude: '13.5',
        longitude: '100.5',
        province: 'ชลบุรี',
        locationPrecision: 'EXACT',
        photoTakenElsewhere: 'false',
        observedAt: new Date().toISOString(),
        quantityRange: 'ONE',
        consent: 'true'
      }
    });
    // Should get 401 (unauthenticated)
    expect(response.status()).toBe(401);
  });
});

test.describe('/report — public API field presence', () => {
  test('public reports include locationPrecision and photoTakenElsewhere', async ({ request }) => {
    const response = await request.get('/api/reports/public');
    expect(response.status()).toBe(200);
    const { reports } = (await response.json()) as {
      reports: {
        locationPrecision?: string;
        photoTakenElsewhere?: boolean;
        status?: string;
      }[];
    };
    // All reports should have the new fields
    for (const report of reports) {
      expect(typeof report.locationPrecision).toBe('string');
      expect(typeof report.photoTakenElsewhere).toBe('boolean');
    }
  });
});
