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

test.describe('language banner — Spanish browser', () => {
  test.use({ locale: 'es-ES' });

  test('offers Spanish on an English page and switches on click', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('.lang-banner');
    await expect(banner).toBeVisible();
    const sw = banner.locator('.lang-banner__switch');
    await expect(sw).toHaveAttribute('href', '/es/');
    await sw.click();
    await expect(page).toHaveURL(/\/es\/$/);
  });

  test('no banner when the page already matches the browser language', async ({ page }) => {
    await page.goto('/es/');
    await expect(page.locator('.lang-banner')).toHaveCount(0);
  });
});

test.describe('language banner — Portuguese browser', () => {
  test.use({ locale: 'pt-BR' });

  test('offers Portuguese on an English page and switches on click', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('.lang-banner');
    await expect(banner).toBeVisible();
    const sw = banner.locator('.lang-banner__switch');
    await expect(sw).toHaveAttribute('href', '/pt/');
    await sw.click();
    await expect(page).toHaveURL(/\/pt\/$/);
  });

  test('no banner when the page already matches the browser language', async ({ page }) => {
    await page.goto('/pt/');
    await expect(page.locator('.lang-banner')).toHaveCount(0);
  });
});

test.describe('language banner — German browser', () => {
  test.use({ locale: 'de-DE' });

  test('offers German on an English page and switches on click', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('.lang-banner');
    await expect(banner).toBeVisible();
    const sw = banner.locator('.lang-banner__switch');
    await expect(sw).toHaveAttribute('href', '/de/');
    await sw.click();
    await expect(page).toHaveURL(/\/de\/$/);
  });

  test('no banner when the page already matches the browser language', async ({ page }) => {
    await page.goto('/de/');
    await expect(page.locator('.lang-banner')).toHaveCount(0);
  });
});

test.describe('language banner — Turkish browser', () => {
  test.use({ locale: 'tr-TR' });

  test('offers Turkish on an English page and switches on click', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('.lang-banner');
    await expect(banner).toBeVisible();
    const sw = banner.locator('.lang-banner__switch');
    await expect(sw).toHaveAttribute('href', '/tr/');
    await sw.click();
    await expect(page).toHaveURL(/\/tr\/$/);
  });

  test('no banner when the page already matches the browser language', async ({ page }) => {
    await page.goto('/tr/');
    await expect(page.locator('.lang-banner')).toHaveCount(0);
  });
});

test.describe('language banner — Chinese browser', () => {
  test.use({ locale: 'zh-CN' });

  test('offers Chinese on an English page and switches on click', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('.lang-banner');
    await expect(banner).toBeVisible();
    const sw = banner.locator('.lang-banner__switch');
    await expect(sw).toHaveAttribute('href', '/zh/');
    await sw.click();
    await expect(page).toHaveURL(/\/zh\/$/);
  });

  test('no banner when the page already matches the browser language', async ({ page }) => {
    await page.goto('/zh/');
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
