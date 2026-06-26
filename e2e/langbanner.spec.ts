import { expect, test } from '@playwright/test';

// Language suggestion banner: suggest the browser's language, never auto-redirect.
test.describe('language banner — Czech browser', () => {
  test.use({ locale: 'cs-CZ' });

  test('offers Czech on an English page and switches on click', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('.lang-banner');
    await expect(banner).toBeVisible();
    const sw = banner.locator('.lang-banner__switch');
    await expect(sw).toHaveAttribute('href', '/cs/');
    await sw.click();
    await expect(page).toHaveURL(/\/cs\/$/);
  });

  test('no banner when the page already matches the browser language', async ({ page }) => {
    await page.goto('/cs/');
    await expect(page.locator('.lang-banner')).toHaveCount(0);
  });

  test('dismiss is remembered — banner stays gone on reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lang-banner__close').click();
    await expect(page.locator('.lang-banner')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.lang-banner')).toHaveCount(0);
  });
});

test.describe('language banner — English browser', () => {
  test.use({ locale: 'en-US' });

  test('no banner for an English browser on an English page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lang-banner')).toHaveCount(0);
  });
});
