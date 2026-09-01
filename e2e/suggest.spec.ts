import { expect, test } from '@playwright/test';
import { fixture } from './helpers';

// The #1 real-world failure is targetTooSmall (users pick an impossible size
// and retry blind). The widget must turn the refusal into a concrete
// suggestion with a one-click "compress to X MB instead" action.
test('infeasible target suggests the minimum feasible size and restarts on click', async ({
  page,
}) => {
  await page.goto('/compress-video/');
  await page.setInputFiles('#compressor input[type=file]', fixture('e2e-240s.mp4'));

  // 2 MB for a 4-minute video is infeasible — the audio floor alone eats it.
  await page.locator('input[name="target-mb"][value="custom"]').check();
  await page.locator('.control-custom-input').fill('2');
  await page.getByRole('button', { name: 'Compress video' }).click();

  const errorBox = page.locator('.widget-error');
  await expect(errorBox).toBeVisible();
  await expect(errorBox).toContainText(/needs at least about \d+ MB/);

  const suggestBtn = errorBox.getByRole('button', { name: /Compress to \d+ MB/ });
  await expect(suggestBtn).toBeVisible();
  const label = (await suggestBtn.textContent())!;
  const mb = Number(label.match(/(\d+)\s*MB/)![1]);
  expect(mb).toBeGreaterThan(2);
  expect(mb).toBeLessThanOrEqual(16); // sane bound for 240s of audio+video

  // One click: adopts the suggested target and restarts the job.
  await suggestBtn.click();
  await expect(page.locator('.progress-bar')).toBeVisible();
  await expect(page.locator('.control-custom-input')).toHaveValue(String(mb));
});

// Every infeasible target has a second way out: keep the size, keep less of
// the video. The widget must offer it, run it, and say what it did.
test('infeasible target also offers to compress the opening stretch that fits', async ({
  page,
}) => {
  // The trimmed job re-encodes ~170 s through ffmpeg.wasm (its 32 kbps audio
  // floor rules WebCodecs out), which takes Firefox 2–3 minutes single-threaded.
  test.slow();
  await page.goto('/compress-video/');
  await page.setInputFiles('#compressor input[type=file]', fixture('e2e-240s.mp4'));
  await page.locator('input[name="target-mb"][value="custom"]').check();
  await page.locator('.control-custom-input').fill('2');
  await page.getByRole('button', { name: 'Compress video' }).click();

  const errorBox = page.locator('.widget-error');
  await expect(errorBox).toBeVisible();
  await expect(errorBox).toContainText(/2 MB fits about the first \d+:\d\d/);

  const trimBtn = errorBox.getByRole('button', { name: /Compress the first \d+:\d\d/ });
  await expect(trimBtn).toBeVisible();
  const [, mm, ss] = (await trimBtn.textContent())!.match(/(\d+):(\d\d)/)!;
  const keptS = Number(mm) * 60 + Number(ss);
  expect(keptS).toBeGreaterThanOrEqual(10);
  expect(keptS).toBeLessThan(240);

  await trimBtn.click();
  await expect(page.locator('.progress-bar')).toBeVisible();

  const result = page.locator('.result:not([hidden])');
  await expect(result).toBeVisible({ timeout: 420_000 });
  await expect(page.locator('.result-note')).toContainText(/Trimmed to the first \d+:\d\d/);

  // The output really is the shorter cut, and really is under the target.
  const { duration, bytes } = await page.locator('a.result-download').evaluate(async (a) => {
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
  expect(bytes).toBeLessThanOrEqual(2_000_000);
  expect(Math.abs(duration - keptS)).toBeLessThanOrEqual(1.5);
});

// Locked pages hide the "bigger target" action (the target is the page's
// promise), so before this the user hit a dead end. Now the trim offer stands
// alone there.
test('locked preset page offers the trim recovery without the bigger-target action', async ({
  page,
}) => {
  await page.goto('/compress-video-to-10mb/');
  await page.setInputFiles('#compressor input[type=file]', fixture('e2e-900s.mp4'));
  await page.getByRole('button', { name: 'Compress video' }).click();

  const errorBox = page.locator('.widget-error');
  await expect(errorBox).toBeVisible();
  await expect(errorBox.getByRole('button', { name: /Compress to \d+ MB/ })).toBeHidden();
  const trimBtn = errorBox.getByRole('button', { name: /Compress the first \d+:\d\d/ });
  await expect(trimBtn).toBeVisible();
  await trimBtn.click();
  await expect(page.locator('.progress-bar')).toBeVisible();
  await expect(page.locator('.progress-engine')).toContainText(/Engine:/, { timeout: 60_000 });
});
