import { expect, test } from '@playwright/test';
import { awaitResult, downloadInfo, fixture, selectFormat } from './helpers';

// Phase 1 conversion: container swaps over the same H.264/AAC pair, so these
// stay on the WebCodecs fast path. Assert the output is the requested container
// (download extension + magic bytes where the container has a distinct header).
test.describe('format conversion → container', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/compress-video/');
  });

  const CASES: { fmt: string; ext: string; magic: number[] | null }[] = [
    { fmt: 'mov', ext: '.mov', magic: null }, // ISOBMFF (ftyp), like mp4
    { fmt: 'mkv', ext: '.mkv', magic: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML header
  ];

  for (const { fmt, ext, magic } of CASES) {
    test(`MP4 → ${fmt.toUpperCase()} produces a ${ext} file`, async ({ page }) => {
      await page.setInputFiles('#compressor input[type=file]', fixture('e2e-10s.mp4'));
      await selectFormat(page, fmt);
      await page.locator('input[name="target-mb"][value="8"]').check();
      await page.getByRole('button', { name: 'Compress video' }).click();

      const out = await awaitResult(page);
      expect(out.outBytes).toBeGreaterThan(100_000); // real file, not a stub
      expect(out.engineLine).toContain('fast mode'); // mov/mkv keep WebCodecs

      const info = await downloadInfo(page);
      expect(info.name.endsWith(ext), `download name ${info.name}`).toBe(true);
      if (magic) expect(info.magic).toEqual(magic);
    });
  }
});
