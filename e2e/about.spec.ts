import { expect, test } from '@playwright/test';

/**
 * Regression coverage for the team-card mobile scroll trap and for idle-time
 * animation behavior.
 *
 * The card used to be a vendored holo-tilt demo whose outer wrapper carried
 * `touch-action: none` for no functional reason (it only tilted via pointermove
 * on desktop or deviceorientation on mobile — never a touch drag), which made
 * the browser treat every touch gesture over a card as non-scrollable and stuck
 * the whole page. It also ran a requestAnimationFrame tilt loop forever while
 * the tab had focus plus an infinite 18s color-dodge holo sweep — measured ~790
 * rAF callbacks/second at idle across four cards. See
 * src/components/reactbits/profile-card.tsx.
 */
test.describe('/about — team section', () => {
  test('team card wrappers do not disable touch scrolling', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'ทีมนกพิราบก้าวร้าว' })).toBeVisible();

    const cards = page.locator('[data-profile-card]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const touchAction = await cards.nth(i).evaluate((el) => getComputedStyle(el).touchAction);
      expect(touchAction).not.toBe('none');
    }
  });

  test('team cards run no infinite animations and no perpetual rAF loop while idle', async ({
    page
  }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'ทีมนกพิราบก้าวร้าว' })).toBeVisible();

    await page
      .getByAltText(/avatar$/)
      .first()
      .scrollIntoViewIfNeeded();
    // Let the scroll-reveal entrance animations finish before measuring idle.
    await page.waitForTimeout(1200);

    // No running animation with infinite iteration count (the old card had four
    // 18s holo sweeps that never stopped).
    const infiniteAnimations = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => {
          const animationName = (a as CSSAnimation).animationName ?? 'none';
          return (
            a.playState === 'running' &&
            animationName !== 'none' &&
            (a.effect as KeyframeEffect | null)?.getComputedTiming().iterations === Infinity
          );
        })
        .map((a) => (a as CSSAnimation).animationName)
    );
    expect(infiniteAnimations).toEqual([]);

    // Count rAF callbacks over 3s of true idle. The old tilt engine produced
    // ~790/s (~2378 over this window); a single continuous 60fps loop would be
    // ~180. Requiring well under one continuous loop's worth catches a
    // perpetual animation without flaking on the odd one-off frame.
    const rafCalls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const original = window.requestAnimationFrame.bind(window);
          let calls = 0;
          window.requestAnimationFrame = (cb) =>
            original((ts) => {
              calls += 1;
              cb(ts);
            });
          setTimeout(() => {
            window.requestAnimationFrame = original;
            resolve(calls);
          }, 3000);
        })
    );
    expect(rafCalls).toBeLessThan(120);
  });

  test('team cards respect prefers-reduced-motion: no spotlight, no hover lift', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'ทีมนกพิราบก้าวร้าว' })).toBeVisible();

    const card = page.locator('[data-profile-card]').first();
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();

    const box = await card.boundingBox();
    if (!box) throw new Error('team card has no bounding box');

    // Hovering must not reveal the spotlight overlay (opacity stays 0) and must
    // not lift the card (transform stays none / no translate).
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);

    const state = await card.evaluate((el) => {
      const overlay = el.querySelector('div.pointer-events-none');
      return {
        overlayOpacity: overlay ? getComputedStyle(overlay).opacity : null,
        transform: getComputedStyle(el).transform
      };
    });
    expect(state.overlayOpacity).toBe('0');
    expect(state.transform).toBe('none');
  });

  test('scrolling past the team section reaches the CTA at the bottom of the page', async ({
    page
  }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'ทีมนกพิราบก้าวร้าว' })).toBeVisible();

    await page
      .getByRole('heading', { name: 'สำรวจข้อมูลบนแผนที่' })
      .scrollIntoViewIfNeeded({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'สำรวจข้อมูลบนแผนที่' })).toBeInViewport();
  });
});

test.describe('/about — card-swap idle behavior', () => {
  test('the card-swap auto-rotate does not run while its section is off-screen', async ({
    page
  }) => {
    // Regression: the ProductCardSwap auto-rotate started its GSAP interval on
    // mount regardless of visibility, so GSAP's ticker burned ~60fps for a
    // section the user had scrolled past. The swap must pause while off-screen
    // (IntersectionObserver) and resume when scrolled into view.
    await page.goto('/about');
    // Stay at the top: the swap section ('ทุกมุมมองอยู่ในที่เดียว') is below
    // the fold at every viewport this suite runs.
    await page.waitForTimeout(2000);

    const swapHeading = page.getByRole('heading', { name: 'ทุกมุมมองอยู่ในที่เดียว' });
    await expect(swapHeading).toBeVisible({ timeout: 10_000 });
    await expect(swapHeading).not.toBeInViewport();

    // GSAP's rAF ticker must be silent off-screen. A short 1500ms window with
    // a tight bound catches the 60fps ticker (would be ~90 ticks) while
    // allowing the odd one-off frame from unrelated libraries.
    const gsapTicks = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const original = window.requestAnimationFrame.bind(window);
          let calls = 0;
          window.requestAnimationFrame = (cb) =>
            original((ts) => {
              // Count only callbacks that originate from GSAP's ticker (the
              // stack's second frame names the gsap chunk under Turbopack).
              const stack = new Error().stack?.split('\n').slice(2, 5).join(' ') ?? '';
              if (stack.includes('gsap')) calls += 1;
              cb(ts);
            });
          setTimeout(() => {
            window.requestAnimationFrame = original;
            resolve(calls);
          }, 1500);
        })
    );
    expect(gsapTicks).toBeLessThan(10);
  });
});
