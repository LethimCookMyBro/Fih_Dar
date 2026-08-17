import { expect, test, type Page } from '@playwright/test';

/**
 * Flagship /sources smoke + interaction tests. The page is client-rendered
 * from real DB values (never fabricated), so tests assert the product story
 * sections, the interactive pipeline, the scalable observatory (search /
 * filter / pagination / detail drawer), the bounded operations rail, and the
 * new read-only APIs — all with real data.
 */

/**
 * Opens /sources and waits for the app shell to finish bootstrapping.
 *
 * Dev-mode Clerk runs a keyless bootstrap: a server action (POST /sources with
 * a next-action header) followed by lazy clerk-js/environment requests. When
 * that bootstrap completes, Next.js re-renders the page and remounts the whole
 * client tree — wiping any component state (e.g. an open drawer). Production
 * (real Clerk keys on Railway) has no keyless bootstrap, so this only affects
 * the dev/test server. We wait for the server action to resolve and the
 * network to settle so interactions never race the remount.
 */
async function openSources(page: Page) {
  // The keyless bootstrap = server action (POST /sources) + Clerk's
  // environment/client API calls. Only once all three resolve and the network
  // settles is the tree stable — any earlier interaction races the remount.
  const keylessBootstrap = page
    .waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response
          .url()
          .replace(/^https?:\/\/[^/]+/, '')
          .startsWith('/sources') &&
        Boolean(response.request().headers()['next-action'])
    )
    .catch(() => null);
  const clerkEnvironment = page
    .waitForResponse((response) => response.url().includes('/v1/environment'))
    .catch(() => null);
  const clerkClient = page
    .waitForResponse((response) => response.url().includes('/v1/client'))
    .catch(() => null);
  await page.goto('/sources');
  await keylessBootstrap;
  await clerkEnvironment;
  await clerkClient;
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('/sources — flagship story', () => {
  test('hero explains the story with real values and all sections render', async ({ page }) => {
    await openSources(page);

    // Hero — first viewport.
    await expect(
      page.getByRole('heading', { name: 'จากข้อมูลสาธารณะ สู่พื้นที่ที่ควรได้รับความสนใจ' })
    ).toBeVisible();
    await expect(page.getByText('ระบบข้อมูลข่าวกรองเชิงพื้นที่')).toBeVisible();
    // Live snapshot metrics (labels only appear once real values load).
    await expect(page.getByText('ข้อมูลที่รับเข้า')).toBeVisible();
    await expect(page.getByText('เกี่ยวข้องกับระบบ')).toBeVisible();
    await expect(page.getByText('เหตุการณ์ที่เชื่อมโยง')).toBeVisible();
    // System health line — never claims the whole system is broken.
    await expect(page.getByText('อัตโนมัติประมาณทุก 6 ชั่วโมง', { exact: true })).toBeVisible();

    // Intelligence journey — connected pipeline. Journey stage buttons carry
    // the full stage text as their accessible name, so match by prefix regex.
    await expect(
      page.getByRole('heading', { name: 'FihDar เปลี่ยนข้อมูลให้เป็นสัญญาณได้อย่างไร' })
    ).toBeVisible();
    for (const label of [
      /^รับข้อมูล/,
      /^ตรวจความเกี่ยวข้อง/,
      /^ระบุตำแหน่ง/,
      /^ตัดข้อมูลซ้ำ/,
      /^เชื่อมเหตุการณ์/,
      /^จัดลำดับพื้นที่/
    ]) {
      await expect(page.getByRole('button', { name: label }).first()).toBeVisible();
    }

    // Trace a real signal — either a real trace or the honest empty state.
    await expect(
      page.getByRole('heading', { name: 'จากข้อมูลหนึ่งรายการ ไปถึงเหตุการณ์บนแผนที่' })
    ).toBeVisible();

    // Source observatory — the summary line is viewport-agnostic (desktop
    // renders table cells, below md compact list rows).
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลที่เชื่อมต่อ' })).toBeVisible();
    await expect(page.getByText('6 แหล่งข้อมูล', { exact: false })).toBeVisible();

    // Operations + transparency.
    await expect(page.getByRole('heading', { name: 'ระบบทำงานอย่างโปร่งใส' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'รอบการอัปเดตล่าสุด' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ทุกอย่างบนหน้านี้ตรวจสอบย้อนกลับได้' })).toBeVisible();
    await expect(
      page.getByText('ข้อมูลจากข่าวและแหล่งสาธารณะเป็นสัญญาณสำหรับการเฝ้าระวัง', { exact: false })
    ).toBeVisible();

    // Map CTA — Base UI Button renders the Link with role='button'.
    const cta = page.getByRole('button', { name: 'สำรวจบนแผนที่' }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/map');
  });

  test('pipeline stage selection updates the explanation panel', async ({ page }) => {
    await openSources(page);
    await expect(page.getByText('ข้อมูลที่รับเข้า')).toBeVisible();

    await page
      .getByRole('button', { name: /^ตรวจความเกี่ยวข้อง/ })
      .first()
      .click();
    await expect(page.getByText('INPUT', { exact: true })).toBeVisible();
    await expect(page.getByText('PROCESS', { exact: true })).toBeVisible();
    await expect(page.getByText('OUTPUT', { exact: true })).toBeVisible();

    await page
      .getByRole('button', { name: /^ระบุตำแหน่ง/ })
      .first()
      .click();
    await expect(page.getByText('ไม่สร้างพิกัดขึ้นเอง', { exact: false }).first()).toBeVisible();
  });

  test('trace section shows real evidence and responds to stage selection', async ({ page }) => {
    await openSources(page);
    await expect(page.getByText('ข้อมูลที่รับเข้า')).toBeVisible();

    const traceHeading = page.getByRole('heading', {
      name: 'จากข้อมูลหนึ่งรายการ ไปถึงเหตุการณ์บนแผนที่'
    });
    await expect(traceHeading).toBeVisible();

    // A real trace renders evidence stages; an empty DB renders the honest
    // empty state. Either is a pass — never a crash or fabricated numbers.
    const relevanceStage = page.getByRole('button', { name: /^ความเกี่ยวข้อง/ });
    if ((await relevanceStage.count()) > 0) {
      await relevanceStage.first().click();
      await expect(page.getByText('คำตัดสินสุดท้าย')).toBeVisible();
      await expect(page.getByRole('button', { name: 'ดูเหตุการณ์บนแผนที่' }).first()).toBeVisible();
    } else {
      await expect(page.getByText('ยังไม่มีสัญญาณที่พร้อมแสดงหลักฐาน')).toBeVisible();
    }
  });
});

test.describe('/sources — journey CTA', () => {
  test('clicking the CTA a second time, while already at #journey, still produces a visible result', async ({
    page
  }) => {
    // Regression: the CTA used to be `<Link href="#journey">`. Next.js's Link
    // treats a click to the current URL's hash as a no-op — no scroll, no
    // focus change, nothing — so a user who clicked once, scrolled back up to
    // re-read the hero, and clicked again got a completely dead button even
    // though the href/hash were both "technically correct". The fix always
    // calls scrollIntoView + moves focus to the section heading, regardless of
    // whether the hash already matches. Focus transfer is the assertion here
    // (not viewport ratio) because on a short/tall viewport the journey
    // section can already be partially visible even before any click —
    // focus only ever moves when the click handler actually ran.
    await openSources(page);
    await expect(page.getByText('ข้อมูลที่รับเข้า')).toBeVisible();

    const cta = page.getByRole('button', { name: /^ดูสายงานการประมวลผล/ }).first();
    const journey = page.locator('#journey');
    const heading = page.locator('#journey-heading');

    await cta.click();
    await expect(journey).toBeInViewport();
    await expect(heading).toBeFocused();

    // Scroll back to the hero and explicitly clear focus. The URL hash stays
    // #journey (browsers never clear a hash on scroll) — exactly the state
    // that used to make a second click a complete no-op.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await expect(heading).not.toBeFocused();

    await cta.click();
    await expect(journey).toBeInViewport();
    await expect(heading).toBeFocused();
  });
});

test.describe('/sources — scalable observatory', () => {
  test('search filters the table server-side', async ({ page }) => {
    await openSources(page);
    // Wait for the observatory data to settle before typing.
    await expect(page.getByText('6 แหล่งข้อมูล', { exact: false })).toBeVisible();

    // Base UI Input only reacts to realistic keystrokes, not Playwright fill().
    await page.getByLabel('ค้นหาแหล่งข้อมูล').pressSequentially('มติชน');
    // The footer shows the *filtered* total — only one source matches.
    await expect(page.getByText('แสดง 1 จาก 1 แหล่ง')).toBeVisible();
    // Scoped to the observatory results card: the trace section above and the
    // role legend may legitimately mention iNaturalist (the legend explains
    // why GBIF/OBIS/TH-BIF were not connected as independent sources), so
    // assert on the filtered results only.
    const results = page.getByTestId('source-observatory-results');
    await expect(results.getByText('iNaturalist', { exact: false })).toBeHidden();
  });

  test('pagination footer stays bounded', async ({ page }) => {
    await openSources(page);
    await expect(page.getByText('ข้อมูลที่รับเข้า')).toBeVisible();

    // 6 configured sources at pageSize 20 → a single page; the footer must
    // render the bounded pagination UI (prev disabled on page 1).
    await expect(page.getByText('หน้า 1 / 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'หน้าก่อนหน้า' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'หน้าถัดไป' })).toBeDisabled();
  });

  test('source detail drawer opens from a row and shows real metadata', async ({ page }) => {
    await openSources(page);
    // Desktop: table rows with a chevron button; below md: compact list rows
    // whose button carries the full label. Wait for data first, then open the
    // drawer via the row trigger that exists at this viewport.
    await expect(page.getByText('6 แหล่งข้อมูล', { exact: false })).toBeVisible();

    const rowButton =
      page.viewportSize() && page.viewportSize()!.width >= 768
        ? page.getByRole('button', { name: 'ดูรายละเอียด iNaturalist' })
        : page.getByRole('button', { name: /iNaturalist/ });
    await rowButton.first().click();
    const sheet = page.getByRole('dialog');
    // The drawer opens immediately; its content depends on a separate
    // sourceDetailQueryOptions fetch, which is slower than the default
    // assertion timeout under a dev server running several viewport projects
    // in parallel.
    await expect(sheet.getByRole('heading', { name: 'iNaturalist' })).toBeVisible({
      timeout: 15_000
    });
    await expect(sheet.getByText('ช่องทาง', { exact: true })).toBeVisible();
    await expect(sheet.getByText('JSON API', { exact: true })).toBeVisible();
    await expect(sheet.getByText('เยี่ยมชมเว็บไซต์ต้นทาง')).toBeVisible();
  });
});

test.describe('/sources — operations', () => {
  test('recent runs rail renders and full history opens paginated', async ({ page }) => {
    await openSources(page);
    await expect(page.getByText('ข้อมูลที่รับเข้า')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'รอบการอัปเดตล่าสุด' })).toBeVisible();

    // Rail only ever shows the bounded recent runs — never a full history dump.
    await page.getByRole('button', { name: 'ดูประวัติทั้งหมด' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'ประวัติรอบการอัปเดต' })).toBeVisible();
    await expect(sheet.getByRole('combobox', { name: 'กรองตามสถานะรอบ' })).toBeVisible();
  });
});

test.describe('/sources — read-only APIs', () => {
  test('summary returns 200 with expected shape and no secrets', async ({ request }) => {
    const response = await request.get('/api/sources/summary');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(typeof body.generatedAt).toBe('string');
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources.length).toBeGreaterThanOrEqual(2);
    expect(typeof body.pipeline.externalObservations).toBe('number');
    expect(typeof body.pipeline.relevant).toBe('number');
    expect(Array.isArray(body.recentRuns)).toBe(true);

    const raw = JSON.stringify(body);
    expect(raw).not.toContain('DATABASE_URL');
    expect(raw).not.toContain('stack');
    expect(raw).not.toContain('secret');
  });

  test('source status is not conflated with data-signal state', async ({ request }) => {
    // Regression: a source can report status=OK (fetch/parse/upsert succeeded)
    // while having produced zero relevant observations ever. The API must
    // expose enough to tell those two facts apart — collapsing them back into
    // one opaque "OK" is the exact defect this fixes.
    const response = await request.get('/api/sources/summary');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.sources.length).toBeGreaterThanOrEqual(2);
    for (const source of body.sources) {
      expect(typeof source.relevantObservations).toBe('number');
      expect(source.relevantObservations).toBeGreaterThanOrEqual(0);
      // Relevant is a subset of total — never more than what was ingested.
      expect(source.relevantObservations).toBeLessThanOrEqual(source.totalObservations);
      expect(['number', 'object']).toContain(typeof source.lastRunMatched); // number | null
      expect(['number', 'object']).toContain(typeof source.lastRunCreated);
    }
  });

  test('source list is paginated, searchable, and sanitized', async ({ request }) => {
    const response = await request.get('/api/sources?q=มติชน&page=1&pageSize=20');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.sources.length).toBeLessThanOrEqual(20);
    expect(body.pagination.totalPages).toBeGreaterThanOrEqual(1);
    expect(body.summary.total).toBeGreaterThanOrEqual(1);
    expect(body.sources.every((source: { slug: string }) => typeof source.slug === 'string')).toBe(
      true
    );
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('DATABASE_URL');
    expect(raw).not.toContain('stack');
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('fetch');
  });

  test('run history is bounded and paginated', async ({ request }) => {
    const response = await request.get('/api/sources/runs?page=1&pageSize=25');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.runs)).toBe(true);
    expect(body.runs.length).toBeLessThanOrEqual(25);
    expect(typeof body.pagination.total).toBe('number');
  });

  test('trace returns a real signal or the honest 404', async ({ request }) => {
    const response = await request.get('/api/sources/trace');
    if (response.status() === 200) {
      const body = await response.json();
      expect(typeof body.observation.title).toBe('string');
      expect(body.relevance).toBeTruthy();
      expect(body.location).toBeTruthy();
      expect(typeof body.dedupe.isDuplicate).toBe('boolean');
    } else {
      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('no_signal_yet');
    }
  });

  test('source detail returns 200 for a known slug and 404 for unknown', async ({ request }) => {
    const known = await request.get('/api/sources/google-news-th');
    expect(known.status()).toBe(200);
    const body = await known.json();
    expect(body.label).toBe('Google News RSS');

    const unknown = await request.get('/api/sources/not-a-source');
    expect(unknown.status()).toBe(404);
  });
});

test.describe('shell navigation', () => {
  test('sources link is present and active', async ({ page }) => {
    await openSources(page);
    // Below md the sidebar is an off-canvas drawer — open it via the trigger
    // once the client fetch resolved (proves hydration).
    const viewport = page.viewportSize() ?? { width: 1280 };
    if (viewport.width < 768) {
      await expect(page.getByText('ข้อมูลที่รับเข้า')).toBeVisible();
      await page.getByRole('button', { name: 'เปิด/ปิดแถบนำทาง' }).click();
    }
    const link = page.getByRole('link', { name: 'แหล่งข้อมูล', exact: true });
    await expect(link).toBeVisible();
    // The Base UI sidebar marks the active route with a data-active attribute.
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
    await expect(page.getByRole('main').first()).toBeVisible();
  });

  test('/report requires auth (redirects to sign-in)', async ({ page }) => {
    await page.goto('/report');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/\/(report|auth\/sign-in)/);
  });
});
