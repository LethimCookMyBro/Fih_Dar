import { expect, test } from '@playwright/test';

/**
 * Regression for the app-shell sticky header bug: `SidebarInset` carried its
 * own `overflow-x-hidden` (see src/app/(app)/layout.tsx), which — per CSS
 * Overflow §3, overflow-x/overflow-y differing forces the other axis to
 * `auto` — turned that flex child into an unintended scroll container.
 * FihDarHeader's `sticky top-0` then stuck to THAT element's scrollport
 * instead of the real page viewport, so it never visibly detached from flow
 * while scrolling. Fixed by removing the redundant overflow-x (the root
 * layout's <body> already carries it, on an element sticky doesn't resolve
 * against).
 *
 * /report, /profile, and /ops share this exact layout component but require
 * a real Clerk session this suite doesn't have — /about and /sources render
 * without auth and exercise the identical FihDarHeader + SidebarInset tree,
 * so a regression here would reproduce identically on the auth-gated pages.
 */

const PAGES = ['/about', '/sources'];

for (const path of PAGES) {
  test(`${path} — header stays pinned to the viewport while the page scrolls`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    const before = await header.boundingBox();
    expect(before).not.toBeNull();
    expect(before!.y).toBeLessThan(2); // pinned to the top edge

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    test.skip(
      scrollHeight <= viewportHeight + 50,
      `${path} has no meaningful scrollable content in this viewport`
    );

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await page.waitForTimeout(200);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(100); // the document actually scrolled

    const after = await header.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.y).toBeLessThan(2); // still pinned — did not scroll away with the content

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasHorizontalScroll).toBe(false);
  });
}
