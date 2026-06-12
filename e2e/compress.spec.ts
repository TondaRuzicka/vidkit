import { expect, test } from '@playwright/test';
import { awaitResult, fixture, startCompress } from './helpers';

test.describe('format matrix → 8 MB target', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/compress-video/');
  });

  // Engine expectations are asserted only where they're stable across
  // machines: H.264 MP4 always has WebCodecs, AVI never does. Codec-
  // dependent cases (H.265, VP9+Opus) assert the outcome, not the route.
  // Formats that can route to single-threaded ffmpeg.wasm use 4s fixtures
  // and a tiny target — 10s of 1080p takes ~4 min through wasm in Firefox.
  const CASES: {
    file: string;
    targetMB: number;
    engine?: 'webcodecs' | 'ffmpeg';
    slow?: boolean;
  }[] = [
    { file: 'e2e-10s.mp4', targetMB: 8, engine: 'webcodecs' },
    { file: 'e2e-10s.mov', targetMB: 8, engine: 'webcodecs' },
    { file: 'e2e-10s.mkv', targetMB: 8, engine: 'webcodecs' },
    { file: 'e2e-4s.webm', targetMB: 2, slow: true },
    { file: 'e2e-h265-4s.mp4', targetMB: 2, slow: true },
    { file: 'e2e-4s.avi', targetMB: 2, engine: 'ffmpeg', slow: true },
  ];

  for (const { file, targetMB, engine, slow } of CASES) {
    test(`${file} compresses to ≤ ${targetMB} MB`, async ({ page }) => {
      if (slow) test.slow(); // 3x timeout: wasm encode path
      await startCompress(page, file, targetMB);
      const out = await awaitResult(page, slow ? 600_000 : 150_000);
      expect(out.outBytes).toBeLessThanOrEqual(targetMB * 1_000_000);
      expect(out.outBytes).toBeGreaterThan(targetMB * 100_000); // sanity: not a stub
      expect(out.sizesText).toMatch(/smaller/);
      if (engine === 'webcodecs') {
        expect(out.engineLine).toContain('hardware-accelerated');
      } else if (engine === 'ffmpeg') {
        expect(out.engineLine).toContain('compatibility mode');
      }
    });
  }
});

test.describe('result integrity', () => {
  test('output is a playable, seekable MP4 with full duration', async ({ page }) => {
    await page.goto('/compress-video/');
    await startCompress(page, 'e2e-10s.mp4', 8);
    await awaitResult(page);
    const check = await page.locator('a.result-download').evaluate(async (a) => {
      const v = document.createElement('video');
      v.muted = true;
      v.src = (a as HTMLAnchorElement).href;
      await new Promise((res, rej) => {
        v.onloadedmetadata = res;
        v.onerror = () => rej(new Error('video element error'));
        setTimeout(() => rej(new Error('metadata timeout')), 10_000);
      });
      const meta = { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
      v.currentTime = Math.min(5, v.duration / 2);
      const seeked = await new Promise((res) => {
        v.onseeked = () => res(true);
        setTimeout(() => res(false), 5_000);
      });
      return { ...meta, seeked };
    });
    expect(check.seeked).toBe(true);
    expect(check.duration).toBeGreaterThan(9.5);
    expect(check.duration).toBeLessThan(10.5);
    expect(check.w).toBeGreaterThan(0);
    expect(await page.locator('a.result-download').getAttribute('download')).toMatch(/\.mp4$/);
  });

  test('unreadable file shows the not-a-video error', async ({ page }) => {
    await page.goto('/compress-video/');
    await page.setInputFiles('#compressor input[type=file]', fixture('e2e-not-a-video.mp4'));
    await page.getByRole('button', { name: 'Compress video' }).click();
    const errorBox = page.locator('.widget-error');
    await expect(errorBox).toBeVisible({ timeout: 90_000 });
    await expect(errorBox).toContainText(/doesn't look like a video|couldn't be decoded|format/i);
  });
});

test.describe('landing page presets', () => {
  test('locked 25 MB page has no preset controls and respects its target', async ({ page }) => {
    await page.goto('/compress-video-to-25mb/');
    await expect(page.locator('.controls-locked')).toHaveText(/25 MB/);
    await expect(page.locator('input[name="target-mb"]')).toHaveCount(0);
    await startCompress(page, 'e2e-60s.mp4', null);
    const out = await awaitResult(page);
    expect(out.outBytes).toBeLessThanOrEqual(25_000_000);
  });

  test('already-under-target notice appears and clears', async ({ page }) => {
    await page.goto('/compress-video/');
    await page.setInputFiles('#compressor input[type=file]', fixture('e2e-10s.mp4'));
    await page.locator('input[name="target-mb"][value="25"]').check();
    await expect(page.locator('.widget-notice')).toBeVisible();
    await expect(page.locator('.widget-notice')).toContainText('already under 25 MB');
    await page.locator('input[name="target-mb"][value="8"]').check();
    await expect(page.locator('.widget-notice')).toBeHidden();
  });
});
