import { expect, type Page } from '@playwright/test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-videos',
  'e2e',
);

export const fixture = (name: string) => join(FIXTURES, name);

/** Pick a file, choose a target preset, start, and capture the engine line. */
export async function startCompress(
  page: Page,
  file: string,
  targetMB: number | null,
): Promise<void> {
  await page.setInputFiles('#compressor input[type=file]', fixture(file));
  if (targetMB !== null) {
    const preset = page.locator(`input[name="target-mb"][value="${targetMB}"]`);
    if (await preset.count()) {
      await preset.check();
    } else {
      await page.locator('input[name="target-mb"][value="custom"]').check();
      await page.locator('.control-custom-input').fill(String(targetMB));
    }
  }
  await page.getByRole('button', { name: 'Compress video' }).click();
}

export interface CompressOutcome {
  outBytes: number;
  engineLine: string;
  sizesText: string;
  dimsText: string;
}

/** Wait for the result screen and return everything worth asserting on. */
export async function awaitResult(
  page: Page,
  timeoutMs = 150_000,
): Promise<CompressOutcome> {
  // engine line appears while running; grab it before the progress UI hides
  const engineLine = await page
    .locator('.progress-engine')
    .filter({ hasText: /Engine:/ })
    .textContent({ timeout: 60_000 });

  // both panels are always in the DOM; wait for whichever un-hides first
  const settled = page
    .locator('.result:not([hidden]), .widget-error:not([hidden])')
    .first();
  await expect(settled).toBeVisible({ timeout: timeoutMs });
  await expect(
    page.locator('.widget-error'),
    'compression errored',
  ).toBeHidden();

  const sizesText = (await page.locator('.result-sizes').textContent())!;
  const dimsText = (await page.locator('.result-dims').textContent())!;
  const outBytes = await page
    .locator('a.result-download')
    .evaluate(async (a) => {
      const blob = await (await fetch((a as HTMLAnchorElement).href)).blob();
      return blob.size;
    });
  return { outBytes, engineLine: engineLine!, sizesText, dimsText };
}
