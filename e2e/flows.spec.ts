import { expect, test } from '@playwright/test';
import { awaitResult, fixture, startCompress } from './helpers';

test('cancel mid-encode shows cancelled state, try-again recovers', async ({ page }) => {
  await page.goto('/compress-video/');
  await startCompress(page, 'e2e-60s.mp4', 8);
  await expect(page.locator('.progress')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  const errorBox = page.locator('.widget-error');
  await expect(errorBox).toBeVisible({ timeout: 10_000 });
  await expect(errorBox).toContainText('cancelled');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.widget-setup')).toBeVisible();
  // the same file is still selected; a fresh run completes
  await page.getByRole('button', { name: 'Compress video' }).click();
  const out = await awaitResult(page);
  expect(out.outBytes).toBeLessThanOrEqual(8_000_000);
});

test('keyboard-only: picker opens from keyboard, focus lands on result', async ({ page }) => {
  await page.goto('/compress-video/');
  // Tab to the dropzone button and confirm Enter opens a file chooser
  await page.locator('.dropzone-button').focus();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.keyboard.press('Enter'),
  ]);
  await chooser.setFiles(fixture('e2e-10s.mp4'));
  // arrow between radio pills works (native radio semantics)
  await page.locator('input[name="target-mb"][value="8"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('input[name="target-mb"][value="8"]')).toBeChecked();
  // Enter on the start button
  await page.getByRole('button', { name: 'Compress video' }).focus();
  await page.keyboard.press('Enter');
  await awaitResult(page);
  // completion must move focus to the result heading (screen reader context)
  await expect(page.locator('.result-heading')).toBeFocused();
  // compare slider responds to keyboard
  const slider = page.locator('.compare-slider');
  await slider.focus();
  const before = await slider.inputValue();
  await page.keyboard.press('ArrowRight');
  expect(Number(await slider.inputValue())).toBeGreaterThan(Number(before));
});

test('compress-another resets cleanly and a second job runs', async ({ page }) => {
  await page.goto('/compress-video/');
  await startCompress(page, 'e2e-10s.mp4', 8);
  await awaitResult(page);
  await page.getByRole('button', { name: 'Compress another video' }).click();
  await expect(page.locator('.dropzone-button')).toHaveText('Drop a video here or browse files');
  await expect(page.getByRole('button', { name: 'Compress video' })).toBeDisabled();
  await startCompress(page, 'e2e-10s.mov', 8);
  const out = await awaitResult(page);
  expect(out.outBytes).toBeLessThanOrEqual(8_000_000);
});

test('no console errors across a full happy-path run', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/compress-video/');
  await startCompress(page, 'e2e-10s.mp4', 8);
  await awaitResult(page);
  expect(errors).toEqual([]);
});
