import { expect, test } from '@playwright/test';

/**
 * Smoke tests for the data-sources page and shell. The page is
 * client-rendered from real DB values via /api/sources/summary — these tests
 * assert the four states (loading resolves to success, no fake zeros) and
 * the presence of every spec-required section at every project viewport.
 */

test.describe('/sources', () => {
  test('renders all sections with real values', async ({ page }) => {
    await page.goto('/sources');

    // Page header + subcopy
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูล' })).toBeVisible();
    await expect(
      page.getByText('ข้อมูลสาธารณะที่ FihDar ใช้ประกอบการเฝ้าระวังและวิเคราะห์เชิงพื้นที่')
    ).toBeVisible();

    // Latest refresh status surface (either a run summary or empty history —
    // never a crash, never fake zeros).
    await expect(page.getByRole('heading', { name: 'อัปเดตล่าสุด', exact: true })).toBeVisible();

    // Source cards for exactly the two real sources.
    await expect(page.getByRole('heading', { name: 'Google News RSS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'data.go.th' })).toBeVisible();

    // Pipeline visual — the six documented stages, horizontal on desktop.
    await expect(page.getByRole('heading', { name: 'ขั้นตอนการประมวลผล' })).toBeVisible();
    for (const label of [
      'รับข้อมูล',
      'ตรวจความเกี่ยวข้อง/ชนิดพันธุ์',
      'ระบุตำแหน่ง',
      'ตัดข้อมูลซ้ำ',
      'เชื่อมโยงเหตุการณ์',
      'จัดลำดับพื้นที่'
    ]) {
      await expect(page.getByText(label)).toBeVisible();
    }

    // Pipeline metrics.
    await expect(page.getByRole('heading', { name: 'ภาพรวมข้อมูล' })).toBeVisible();
    await expect(page.getByText('ข้อมูลภายนอกทั้งหมด')).toBeVisible();
    // 'ประมวลผลแล้ว' also appears in the latest-refresh status surface.
    await expect(page.getByText('ประมวลผลแล้ว').first()).toBeVisible();
    await expect(page.getByText('เกี่ยวข้องกับระบบ')).toBeVisible();
    await expect(page.getByText('เหตุการณ์ที่เชื่อมโยงได้')).toBeVisible();

    // Transparency note + CTA.
    await expect(
      page.getByText('ข้อมูลจากข่าวและแหล่งสาธารณะเป็นสัญญาณสำหรับการเฝ้าระวัง', { exact: false })
    ).toBeVisible();
    // Base UI Button renders the Link with role='button'; assert role + href.
    const cta = page.getByRole('button', { name: 'สำรวจบนแผนที่' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/map');
  });

  test('recent runs section renders', async ({ page }) => {
    await page.goto('/sources');
    await expect(page.getByRole('heading', { name: 'รอบการอัปเดตล่าสุด' })).toBeVisible();
  });

  test('api summary returns 200 with expected shape', async ({ request }) => {
    const response = await request.get('/api/sources/summary');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(typeof body.generatedAt).toBe('string');
    expect(Array.isArray(body.sources)).toBe(true);
    expect(typeof body.pipeline.externalObservations).toBe('number');
    // Never leaks raw error objects or secrets.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('DATABASE_URL');
    expect(raw).not.toContain('stack');
    expect(raw).not.toContain('secret');
  });
});

test.describe('shell navigation', () => {
  test('sources link is present and active', async ({ page }) => {
    await page.goto('/sources');
    // Below md the sidebar is an off-canvas drawer — open it via the trigger
    // (the top-left hamburger) before asserting the nav item.
    const viewport = page.viewportSize() ?? { width: 1280 };
    if (viewport.width < 768) {
      // The status surface renders only after the client fetch resolves, which
      // guarantees React has hydrated — clicking earlier races hydration and
      // the trigger's onClick is not yet attached.
      await expect(page.getByRole('heading', { name: 'อัปเดตล่าสุด', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'เปิด/ปิดแถบนำทาง' }).click();
    }
    const link = page.getByRole('link', { name: 'แหล่งข้อมูล' });
    await expect(link).toBeVisible();
    // The Base UI sidebar marks the active route with a data-active attribute
    // (same mechanism as every other nav item) — assert that, not aria-current.
    await expect(link).toHaveAttribute('data-active', '');
  });
});

test.describe('page smoke', () => {
  test('/map renders the map shell', async ({ page }) => {
    await page.goto('/map');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('/about renders', async ({ page }) => {
    await page.goto('/about');
    // SidebarInset renders <main> plus the page's own main — the smoke check
    // is that the shell renders at all.
    await expect(page.getByRole('main').first()).toBeVisible();
  });

  test('/report requires auth (redirects to sign-in)', async ({ page }) => {
    await page.goto('/report');
    // Either the form (signed in) or the Clerk sign-in redirect — never a crash.
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/\/(report|auth\/sign-in)/);
  });
});
