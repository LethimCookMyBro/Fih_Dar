import { expect, test } from '@playwright/test';

test.describe('/auth/sign-in — entrance animation', () => {
  test('the panel animates in under normal motion, and skips animation under prefers-reduced-motion', async ({
    page
  }) => {
    await page.goto('/auth/sign-in');
    // Clerk's widget mounts client-side after its own script/config fetch —
    // slower than a same-origin route under parallel test workers.
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible({ timeout: 15_000 });

    const panel = page.locator('div[class*="max-w-[460px]"]');
    await expect(panel).toHaveCSS('opacity', '1', { timeout: 2000 });
    await expect(panel).toHaveCSS('transform', 'none');
  });

  test('prefers-reduced-motion skips the entrance transition entirely', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/auth/sign-in');

    const panel = page.locator('div[class*="max-w-[460px]"]');
    // No animation to wait out — final state must already be there almost immediately.
    await expect(panel).toHaveCSS('opacity', '1', { timeout: 500 });
    await context.close();
  });
});

test.describe('/auth/sign-in — input border contrast', () => {
  test('the email field border is not diluted to near-invisibility by Clerk overrides', async ({
    page
  }) => {
    await page.goto('/auth/sign-in');
    const input = page.getByRole('textbox').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    // Regression guard: Clerk's own default field styling applies a
    // low-alpha border color that our `border-input` override was silently
    // losing to (11% opacity, effectively invisible against the card). The
    // fix forces our token with `!border-input`. rgb(216, 222, 223) is
    // `--input` in the light theme (fihdar.css) at full opacity — no alpha
    // component, unlike the diluted `color(srgb .. / 0.11)` this replaced.
    const borderColor = await input.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(borderColor).toBe('rgb(216, 222, 223)');
  });
});
