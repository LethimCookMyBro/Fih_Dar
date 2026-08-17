import { expect, test, type Page } from '@playwright/test';

/**
 * /map regression coverage for the production-truth audit fixes:
 * - the priority panel must never claim it ranks from citizen reports (it
 *   ranks from external-source EventCandidates only)
 * - the legend's report count must be labelled as verified citizen reports,
 *   distinct from the external-source layer it can optionally add
 */

/**
 * The map's own floating controls (legend, layer toggles, priority panel)
 * only render once `mapReady` is true, which requires a real external
 * tile-style fetch + WebGL init to finish — under several Playwright viewport
 * projects hitting one dev server at once, that can take longer than a fixed
 * short wait. Waiting for the "กำลังโหลดแผนที่…" status to disappear is an
 * honest readiness signal instead of an arbitrary timeout.
 */
async function waitForMapReady(page: Page) {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('กำลังโหลดแผนที่')).toBeHidden({ timeout: 20_000 });
}

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
  test('legend counts citizen reports and operational events separately, never conflated', async ({
    page
  }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    // Below md the legend is collapsed behind an icon toggle; open it first.
    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }

    // The default map view surfaces the operational-events layer (EventCandidates
    // ranked by priority) alongside citizen reports — this is the fix for the
    // "map looks disconnected from the intelligence pipeline" defect. Each count
    // uses its own domain-correct term and must never borrow the other's label.
    const reportCountLine = page.getByText(/^แสดง \d+ รายงานจากประชาชน$/);
    await expect(reportCountLine).toBeVisible();
    await expect(reportCountLine).not.toContainText('เหตุการณ์');

    const eventCountLine = page.getByText(/เหตุการณ์ที่มีพิกัดแน่นอน จาก \d+ เหตุการณ์ทั้งหมด/);
    await expect(eventCountLine).toBeVisible();
    await expect(eventCountLine).not.toContainText('รายงานจากประชาชน');
  });

  test('enabling the external-source layer adds a distinct, labelled count', async ({ page }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    const legendCountBefore = await page
      .getByText('จากแหล่งภายนอก (เฉพาะจุดที่มีพิกัด)', { exact: false })
      .count();
    expect(legendCountBefore).toBe(0); // off by default — no external count line yet

    // Below md the layer toggles live inside the "ตัวกรอง" bottom sheet, not
    // the desktop layers popover.
    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    await page.getByRole('button', { name: isMobile ? 'ตัวกรอง' : 'เลเยอร์แผนที่' }).click();
    // force: true — Clerk's dev-only "keyless mode" banner (no local
    // NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is configured) can render over this
    // corner on narrow viewports and fails Playwright's "receives pointer
    // events" actionability check. It never renders with real keys
    // (production), so it is irrelevant to what this assertion verifies —
    // the checkbox toggling the legend's count line.
    await page.locator('#layer-observations-label').click({ force: true });
    await page.keyboard.press('Escape');

    // Below md the legend also needs opening to read the count line.
    if (isMobile) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }
    await expect(page.getByText('จากแหล่งภายนอก (เฉพาะจุดที่มีพิกัด)', { exact: false })).toBeVisible();
  });
});

test.describe('/map — operational events are discoverable by default', () => {
  test('the events layer is on out of the box, without opening any hidden layer toggle', async ({
    page
  }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }

    // A first-time visitor must see operational-event counts without ever
    // discovering a hidden layer toggle — this is the fix for "the map still
    // looks disconnected from the ~64-event intelligence pipeline".
    await expect(page.getByText(/เหตุการณ์ที่มีพิกัดแน่นอน จาก \d+ เหตุการณ์ทั้งหมด/)).toBeVisible();

    // Confirm the toggle itself is checked by default, not just that some
    // count text happens to render.
    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    await page.getByRole('button', { name: isMobile ? 'ตัวกรอง' : 'เลเยอร์แผนที่' }).click();
    await expect(page.getByRole('checkbox', { name: 'เหตุการณ์ที่เชื่อมโยง (ทดลอง)' })).toBeChecked();
  });
});

test.describe('/map — event detail panel', () => {
  test('opening an operational event shows a real detail panel with evidence', async ({ page }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    // MapLibre features are rendered on a WebGL canvas — hit-testing a real
    // canvas pixel from Playwright is inherently flaky (it depends on tile
    // load timing and headless WebGL rendering). The priority list's "ไปที่
    // ตำแหน่งบนแผนที่" button drives the exact same state transition
    // (setSelectedEventSlug → <EventPanel>) that a canvas marker click does,
    // so it exercises the real code path deterministically.
    await page.getByRole('button', { name: /อันดับพื้นที่/ }).click();
    const list = page.getByRole('dialog', { name: /อันดับพื้นที่/ });
    await expect(list).toBeVisible();

    const areaCards = list.locator('li');
    // Wait for the real list (skeletons render as plain <div>s, never <li>) —
    // priorityAreasQueryOptions is a real DB-backed fetch, slower than the
    // dialog's own open animation.
    await expect(areaCards.first()).toBeVisible({ timeout: 15_000 });
    const count = await areaCards.count();
    expect(count).toBeGreaterThan(0);

    // Cap attempts and always collapse a non-matching card before moving on —
    // expanding all ~64 accordion cards in a height-constrained bottom sheet
    // (mobile/tablet-portrait) makes later cards' click targets keep moving
    // and is not needed: with 55/64 local events at EXACT precision, one of
    // the first few cards is overwhelmingly likely to have a coordinate.
    let opened = false;
    for (let i = 0; i < Math.min(count, 5) && !opened; i += 1) {
      const card = areaCards.nth(i);
      const toggle = card.getByRole('button').first();
      await toggle.click();
      const flyButton = card.getByRole('button', { name: 'ไปที่ตำแหน่งบนแผนที่' });
      if ((await flyButton.count()) > 0) {
        await flyButton.click();
        opened = true;
      } else {
        await toggle.click(); // collapse before trying the next card
      }
    }
    // Only EXACT-precision events ever get a coordinate; if genuinely none of
    // the current events have one, there is nothing dishonest to click.
    test.skip(!opened, 'no current event has an exact map coordinate to fly to');

    const detail = page.getByRole('dialog', { name: /รายละเอียดเหตุการณ์/ });
    await expect(detail).toBeVisible();
    // Real provenance, not a placeholder: priority tier, honest location
    // precision, and the underlying signals that make up the event.
    await expect(detail.getByText(/ความสำคัญ/)).toBeVisible();
    await expect(detail.getByText('พิกัดที่ระบุ')).toBeVisible();
    await expect(detail.getByText(/สัญญาณที่ประกอบเป็นเหตุการณ์นี้/)).toBeVisible();
    await expect(detail.getByText(/แหล่งอิสระยืนยัน/)).toBeVisible();
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
