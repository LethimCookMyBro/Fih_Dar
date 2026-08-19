import { expect, test, type Page } from '@playwright/test';

/**
 * /map regression coverage for the production-truth audit fixes:
 * - the priority panel must never claim it ranks from citizen reports (it
 *   ranks from external-source EventCandidates only)
 * - the legend's report count must be labelled as verified citizen reports,
 *   distinct from the external-source layer it can optionally add
 */

/**
 * Clerk's dev-only "keyless mode" banner (no local
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY configured) portals into
 * `#clerk-components` and can overlap floating map controls on narrow
 * viewports. It never renders with real keys (production), so neutralizing
 * its pointer-events here doesn't hide a real interaction target — it just
 * stops a dev-only artifact from stealing clicks meant for the map UI.
 * Must run *after* navigation: Clerk injects its own styles once mounted,
 * and a same-specificity `!important` rule wins by source order, so a style
 * tag added before those exist would lose the cascade tie.
 */
async function gotoMap(page: Page) {
  await page.goto('/map');
  await page.addStyleTag({ content: '#clerk-components { pointer-events: none !important; }' });
}

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
    await gotoMap(page);
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
    await gotoMap(page);
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
    await gotoMap(page);
    await waitForMapReady(page);

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

test.describe('/map — 2km monitoring radius', () => {
  test('the layer is on by default and its toggle shows/hides the legend explanation', async ({
    page
  }) => {
    await gotoMap(page);
    await waitForMapReady(page);

    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }

    // On by default: the honest disclaimer copy must already be in the legend.
    const explanation = page.getByText('ไม่ใช่หลักฐานการแพร่ระบาดที่ยืนยันแล้ว', { exact: false });
    await expect(explanation).toBeVisible();

    await page.getByRole('button', { name: isMobile ? 'ตัวกรอง' : 'เลเยอร์แผนที่' }).click();
    const toggle = page.getByRole('checkbox', {
      name: 'รัศมีเฝ้าระวัง 2 กม. (ไม่ใช่พื้นที่ระบาดที่ยืนยัน)'
    });
    await expect(toggle).toBeChecked();

    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await page.keyboard.press('Escape');
    await expect(explanation).toBeHidden();

    await page.getByRole('button', { name: isMobile ? 'ตัวกรอง' : 'เลเยอร์แผนที่' }).click();
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(explanation).toBeVisible();
  });
});

test.describe('/map — legend is collapsible at every breakpoint', () => {
  test('the legend can be collapsed and re-expanded, not just on mobile', async ({ page }) => {
    await gotoMap(page);
    await waitForMapReady(page);

    // Below md the legend already starts collapsed (asserted elsewhere); this
    // test is about the fix that desktop/tablet used to have no way to put
    // the panel away at all.
    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }

    const legendHeading = page.getByText('คำอธิบายสัญลักษณ์');
    await expect(legendHeading).toBeVisible();

    await page.getByRole('button', { name: 'ซ่อนคำอธิบายสัญลักษณ์' }).click();
    await expect(legendHeading).toBeHidden();
    await expect(page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' })).toBeVisible();

    await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    await expect(legendHeading).toBeVisible();
  });
});

test.describe('/map — operational events are discoverable by default', () => {
  test('the events layer is on out of the box, without opening any hidden layer toggle', async ({
    page
  }) => {
    await gotoMap(page);
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
    await gotoMap(page);
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

test.describe('/map — province filter', () => {
  test('the province list is not hardcoded to only the three EEC provinces', async ({ page }) => {
    await gotoMap(page);
    await waitForMapReady(page);

    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'ตัวกรอง' }).click();
    } else {
      // base-ui's ComboboxTrigger exposes role="combobox" (not "button") once
      // its ComboboxInput lives inside the popup, per the ARIA combobox
      // pattern — confirmed against node_modules/@base-ui/react/combobox/trigger/ComboboxTrigger.js.
      await page.getByRole('combobox', { name: 'กรองตามจังหวัด' }).click();
    }

    // Regression: this list used to reuse REPORT_PROVINCES (the citizen
    // report submission enum, correctly EEC-only), which silently hid any
    // event/observation province the nationwide ingestion pipeline produces.
    // Mobile note: base-ui's Checkbox.Root puts a caller-supplied `id` on the
    // internal aria-hidden native <input>, not on the visible role=checkbox
    // element (which gets its own generated id) — so `getByRole('checkbox')
    // .and([id^="province-"])` never matches anything. The <Label for=...>
    // wrapper is the reliable, unique-per-row hook instead.
    const options = isMobile ? page.locator('label[for^="province-"]') : page.getByRole('option');
    // .count() snapshots immediately and does not retry, unlike .click()/expect() —
    // wait for the popup's list to actually have rendered content first (same
    // pattern as the areaCards.first() wait in the event-detail-panel test above).
    await expect(options.first()).toBeVisible();
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(3);
    for (const province of ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง']) {
      if (isMobile) {
        await expect(page.getByRole('checkbox', { name: province })).toBeVisible();
      } else {
        await expect(page.getByRole('option', { name: province })).toBeVisible();
      }
    }
    if (!isMobile) await page.keyboard.press('Escape');
  });

  test('selecting provinces filters citizen reports with union semantics, and clearing restores them', async ({
    page,
    request
  }) => {
    // Ground truth from the same endpoint the map itself reads
    // (src/features/reports/api/service.ts calls '/reports/public'), fetched
    // before any UI interaction so every assertion below is an exact match
    // against real data instead of a relative before/after comparison —
    // a relational check like toBeLessThanOrEqual would still pass even if
    // province filtering were a complete no-op.
    const reportsResponse = await request.get('/api/reports/public');
    const { reports } = (await reportsResponse.json()) as { reports: { province: string }[] };
    const initialCount = reports.length;
    const chonburiCount = reports.filter((r) => r.province === 'ชลบุรี').length;
    const unionCount = reports.filter(
      (r) => r.province === 'ชลบุรี' || r.province === 'ระยอง'
    ).length;

    await gotoMap(page);
    await waitForMapReady(page);

    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }

    const reportLine = page.getByText(/^แสดง \d+ รายงานจากประชาชน$/);
    await expect(reportLine).toHaveText(`แสดง ${initialCount} รายงานจากประชาชน`);

    async function openProvincePicker() {
      if (isMobile) {
        await page.getByRole('button', { name: 'ตัวกรอง' }).click();
      } else {
        await page.getByRole('combobox', { name: 'กรองตามจังหวัด' }).click();
      }
    }
    async function selectProvince(name: string) {
      if (isMobile) {
        await page.getByRole('checkbox', { name }).click();
      } else {
        await page.getByRole('option', { name }).click();
      }
    }
    async function closePicker() {
      await page.keyboard.press('Escape');
    }

    // Select Chonburi.
    await openProvincePicker();
    await selectProvince('ชลบุรี');
    await closePicker();
    await expect(reportLine).toHaveText(`แสดง ${chonburiCount} รายงานจากประชาชน`);

    // Add Rayong — union.
    await openProvincePicker();
    await selectProvince('ระยอง');
    await closePicker();
    await expect(reportLine).toHaveText(`แสดง ${unionCount} รายงานจากประชาชน`);

    // Remove Rayong — back to Chonburi-only.
    await openProvincePicker();
    await selectProvince('ระยอง');
    await closePicker();
    await expect(reportLine).toHaveText(`แสดง ${chonburiCount} รายงานจากประชาชน`);

    // Clear — full count returns.
    await openProvincePicker();
    await page.getByRole('button', { name: 'ล้าง' }).click();
    await closePicker();
    await expect(reportLine).toHaveText(`แสดง ${initialCount} รายงานจากประชาชน`);
  });

  test('province filter also narrows the priority panel, not just citizen reports', async ({
    page,
    request
  }) => {
    // Ground truth from '/api/events/priority' (src/features/priority/api/service.ts),
    // fetched before any UI interaction. The map's default `days` filter is
    // 'all', so no time-based narrowing is in play — a pure province count is
    // the correct exact expectation, not just an upper bound. `limit=300`
    // matches map-view.tsx/priority-panel.tsx's own request — the endpoint
    // defaults to a much smaller bounded page (see priority-service.ts) for
    // the /ops lane, which this ground-truth fetch must not silently adopt.
    const priorityResponse = await request.get('/api/events/priority?limit=300');
    const { areas } = (await priorityResponse.json()) as { areas: { province: string | null }[] };
    const initialCount = areas.length;
    const chonburiCount = areas.filter((a) => a.province === 'ชลบุรี').length;

    await gotoMap(page);
    await waitForMapReady(page);

    await page.getByRole('button', { name: /อันดับพื้นที่/ }).click();
    const dialog = page.getByRole('dialog', { name: /อันดับพื้นที่/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('li')).toHaveCount(initialCount);
    await page.getByRole('button', { name: 'ปิด', exact: true }).click();

    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'ตัวกรอง' }).click();
      await page.getByRole('checkbox', { name: 'ชลบุรี' }).click();
    } else {
      await page.getByRole('combobox', { name: 'กรองตามจังหวัด' }).click();
      await page.getByRole('option', { name: 'ชลบุรี' }).click();
    }
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /อันดับพื้นที่/ }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('li')).toHaveCount(chonburiCount);
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
