import { expect, test } from '@playwright/test';

/**
 * /map regression coverage for the production-truth audit fixes:
 * - the priority panel must never claim it ranks from citizen reports (it
 *   ranks from external-source EventCandidates only)
 * - the legend's report count must be labelled as verified citizen reports,
 *   distinct from the external-source layer it can optionally add
 */

test.describe('/map — priority panel provenance', () => {
  test('priority panel never implies it comes from citizen reports', async ({ page }) => {
    await page.goto('/map');
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: /อันดับพื้นที่/ }).click();
    const dialog = page.getByRole('dialog', { name: /อันดับพื้นที่/ });
    await expect(dialog).toBeVisible();

    // Regression: this line used to say "ranked from verified-report
    // evidence only", which is false — the ranking is over EventCandidates
    // built from news/external sources, never SightingReport.
    await expect(dialog.getByText('ไม่รวมรายงานจากประชาชน')).toBeVisible();
    await expect(dialog.getByText('จัดอันดับจากหลักฐานรายงานที่ผ่านการตรวจสอบเท่านั้น')).toHaveCount(0);
  });
});

test.describe('/map — legend truthfulness', () => {
  test('legend labels the report count as verified citizen reports', async ({ page }) => {
    await page.goto('/map');
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(1000);

    // Below md the legend is collapsed behind an icon toggle; open it first.
    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }

    await expect(
      page.getByText('แสดง', { exact: false }).getByText('รายงานที่ยืนยันแล้ว')
    ).toBeVisible();
  });

  test('enabling the external-source layer adds a distinct, labelled count', async ({ page }) => {
    await page.goto('/map');
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(1000);

    const legendCountBefore = await page
      .getByText('จากแหล่งภายนอก (เฉพาะจุดที่มีพิกัด)', { exact: false })
      .count();
    expect(legendCountBefore).toBe(0); // off by default — no external count line yet

    // Below md the layer toggles live inside the "ตัวกรอง" bottom sheet, not
    // the desktop layers popover.
    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    await page.getByRole('button', { name: isMobile ? 'ตัวกรอง' : 'เลเยอร์แผนที่' }).click();
    await page.locator('#layer-observations-label').click();
    await page.keyboard.press('Escape');

    // Below md the legend also needs opening to read the count line.
    if (isMobile) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }
    await expect(page.getByText('จากแหล่งภายนอก (เฉพาะจุดที่มีพิกัด)', { exact: false })).toBeVisible();
  });
});

test.describe('/map — read-only APIs', () => {
  test('public observations endpoint excludes nothing beyond documented shape', async ({
    request
  }) => {
    const response = await request.get('/api/observations/public');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.observations)).toBe(true);
    for (const observation of body.observations) {
      expect(typeof observation.id).toBe('string');
      expect(typeof observation.sourceName).toBe('string');
      expect(typeof observation.sourceUrl).toBe('string');
    }
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('DATABASE_URL');
    expect(raw).not.toContain('secret');
  });
});
