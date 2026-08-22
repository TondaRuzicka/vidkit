import { expect, test } from '@playwright/test';
import { DEFAULT_LOCALE, PAGES, pagePath } from '../src/config';

// The hub index, the related blocks and the breadcrumbs are all generated from
// the PAGES registry. That is what keeps every page reachable by crawling —
// which matters more than usual here, because Search Console has never managed
// to fetch the sitemap, leaving links as Google's only route into the site.
// A page silently missing from its hub would be invisible without these checks.

const englishTools = PAGES.filter(
  (p) =>
    p.category &&
    p.category !== 'hub' &&
    (p.locales as readonly string[]).includes(DEFAULT_LOCALE),
);

test('/video-tools/ links every English tool page', async ({ page }) => {
  await page.goto('/video-tools/');
  const hrefs = await page.locator('main .convert-links a').evaluateAll((as) =>
    as.map((a) => a.getAttribute('href')),
  );
  for (const p of englishTools) {
    expect(hrefs, `${p.id} missing from the hub index`).toContain(
      pagePath(p, DEFAULT_LOCALE),
    );
  }
  expect(hrefs.length).toBe(englishTools.length);
});

test('/convert-video/ lists the converters and nothing else', async ({ page }) => {
  await page.goto('/convert-video/');
  const hrefs = await page.locator('main .convert-links a').evaluateAll((as) =>
    as.map((a) => a.getAttribute('href')),
  );
  const converters = englishTools.filter((p) => p.category === 'convert');
  expect(hrefs.sort()).toEqual(
    converters.map((p) => pagePath(p, DEFAULT_LOCALE)).sort(),
  );
});

test.describe('every tool page carries a related block and breadcrumbs', () => {
  for (const p of englishTools) {
    test(`${p.id}`, async ({ page }) => {
      const path = pagePath(p, DEFAULT_LOCALE);
      await page.goto(path);

      const related = page.locator('.related-all').locator('..');
      await expect(related, 'related block present').toBeVisible();
      const links = related.locator('.convert-links a');
      expect(await links.count()).toBeGreaterThan(0);
      // Never recommends itself.
      const hrefs = await links.evaluateAll((as) =>
        as.map((a) => a.getAttribute('href')),
      );
      expect(hrefs).not.toContain(path);

      const crumbs = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((els) =>
          els
            .map((e) => JSON.parse(e.textContent!))
            .find((j) => j['@type'] === 'BreadcrumbList'),
        );
      expect(crumbs, 'BreadcrumbList emitted').toBeTruthy();
      // Home → hub → self, and the trail must end on this page.
      const items = crumbs.itemListElement;
      expect(items.length).toBe(3);
      expect(items[2].item).toContain(path);
      // Entities must be decoded — "25&nbsp;MB" would show verbatim otherwise.
      for (const i of items) expect(i.name).not.toContain('&');
    });
  }
});

test('a localized page offers only links available in its own locale', async ({ page }) => {
  await page.goto('/cs/mov-na-mp4/');
  const hrefs = await page
    .locator('main .convert-links a')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) {
    expect(h, `${h} is not a Czech URL`).toMatch(/^\/cs\//);
  }
});
