import { expect, test } from '@playwright/test';
import { awaitResult, fixture } from './helpers';

/** Duration and size of the downloadable result, read from the result blob. */
async function outputMedia(page: import('@playwright/test').Page) {
  return page.locator('a.result-download').evaluate(async (a) => {
    const blob = await (await fetch((a as HTMLAnchorElement).href)).blob();
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = URL.createObjectURL(blob);
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(new Error('metadata'));
    });
    return { duration: v.duration, bytes: blob.size };
  });
}

// The trim tool's promise is an exact range: the output must be the seconds
// the sliders showed, not the nearest keyframe.
test('/trim-video/ keeps exactly the chosen range', async ({ page }) => {
  await page.goto('/trim-video/');
  await page.setInputFiles('#compressor input[type=file]', fixture('e2e-10s.mp4'));

  const start = page.locator('input[name="trim-start"]');
  const end = page.locator('input[name="trim-end"]');
  await expect(start).toBeEnabled(); // metadata loaded → sliders live
  await expect(end).toHaveValue('10');

  await start.fill('2');
  await end.fill('6');
  await expect(page.locator('.trim-keep')).toContainText('0:04.0 of 0:10.0');

  // Trim pages start in quality mode — no target pills should be showing.
  await expect(page.locator('input[name="quality-level"][value="high"]')).toBeChecked();
  await page.getByRole('button', { name: 'Trim video' }).click();

  const out = await awaitResult(page);
  expect(out.engineLine).toContain('fast mode');
  await expect(page.locator('.result-note')).toContainText('Kept 0:02.0 to 0:06.0');

  const media = await outputMedia(page);
  expect(Math.abs(media.duration - 4)).toBeLessThanOrEqual(0.3);
  expect(media.bytes).toBeGreaterThan(100_000);
});

// Sliders left at the ends mean "the whole file": no trim is applied and the
// result reads like an ordinary conversion.
test('/trim-video/ with untouched sliders keeps the whole video', async ({ page }) => {
  await page.goto('/trim-video/');
  await page.setInputFiles('#compressor input[type=file]', fixture('e2e-4s.mp4'));
  await expect(page.locator('input[name="trim-start"]')).toBeEnabled();
  await page.getByRole('button', { name: 'Trim video' }).click();
  await awaitResult(page);
  await expect(page.locator('.result-note')).toBeHidden();
  const media = await outputMedia(page);
  expect(Math.abs(media.duration - 4)).toBeLessThanOrEqual(0.3);
});

// The compress page offers the same controls behind a collapsed row, and a
// range there combines with a size target in one pass.
test('/compress-video/ optional trim row trims and fits the target together', async ({ page }) => {
  await page.goto('/compress-video/');
  await page.setInputFiles('#compressor input[type=file]', fixture('e2e-10s.mp4'));
  const row = page.locator('details.trim-optional');
  await expect(row).toBeVisible();
  await row.locator('summary').click();
  const end = page.locator('input[name="trim-end"]');
  await expect(end).toBeEnabled();
  await end.fill('5');
  await page.locator('input[name="target-mb"][value="8"]').check();
  await page.getByRole('button', { name: 'Compress video' }).click();
  const out = await awaitResult(page);
  expect(out.outBytes).toBeLessThanOrEqual(8_000_000);
  await expect(page.locator('.result-note')).toContainText('Kept 0:00.0 to 0:05.0');
  const media = await outputMedia(page);
  expect(Math.abs(media.duration - 5)).toBeLessThanOrEqual(0.3);
});
