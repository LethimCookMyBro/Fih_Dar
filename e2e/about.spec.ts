import { expect, test } from '@playwright/test';

/**
 * Regression coverage for the team-card mobile scroll trap: ProfileCard's
 * outer wrapper used to carry `touch-action: none` for no functional reason
 * (the card only tilts via pointermove on desktop or deviceorientation on
 * mobile — never a touch drag), which made the browser treat every touch
 * gesture over a card as non-scrollable and stuck the whole page. See
 * src/components/reactbits/profile-card.tsx.
 */
test.describe('/about — team section never traps scroll', () => {
  test('team card wrappers do not disable touch scrolling', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'ทีมนกพิราบก้าวร้าว' })).toBeVisible();

    const avatars = page.getByAltText(/avatar$/);
    await avatars.first().scrollIntoViewIfNeeded();
    const count = await avatars.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const wrap = avatars.nth(i).locator('xpath=ancestor::div[contains(@style,"perspective")]');
      const touchAction = await wrap.evaluate((el) => getComputedStyle(el).touchAction);
      expect(touchAction).not.toBe('none');
    }
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
