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
