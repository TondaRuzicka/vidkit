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

// Phase 3: conversion landing pages lock the output format (no selector) and
// must produce that format from whatever is dropped.
test.describe('conversion landing pages (locked format)', () => {
  const CASES = [
    { path: '/mov-to-mp4/', ext: '.mp4', engine: 'fast mode', slow: false },
    { path: '/mp4-to-mp3/', ext: '.mp3', engine: 'compatibility mode', slow: true },
  ];
  for (const { path, ext, engine, slow } of CASES) {
    test(`${path} outputs ${ext}`, async ({ page }) => {
      if (slow) test.slow();
      await page.goto(path);
      // No format selector on locked pages.
      await expect(page.locator('input[name="output-format"]')).toHaveCount(0);
      await page.setInputFiles('#compressor input[type=file]', fixture('e2e-4s.mp4'));
      // mp4 output keeps the size control; audio hides it and uses defaults.
      const target = page.locator('input[name="target-mb"][value="8"]');
      if (await target.isVisible()) await target.check();
      await page.getByRole('button', { name: 'Compress video' }).click();
      const out = await awaitResult(page, slow ? 600_000 : 150_000);
      expect(out.engineLine).toContain(engine);
      expect((await downloadInfo(page)).name.endsWith(ext)).toBe(true);
    });
  }
});

// Phase 2: codecs WebCodecs can't encode → software (ffmpeg.wasm). Slow, so a
// 4s fixture. WebM re-encodes video; m4a/mp3 extract audio; gif rasterises.
test.describe('format conversion → ffmpeg formats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/compress-video/');
  });

  const CASES: { fmt: string; ext: string; magic: number[] | null; video: boolean }[] = [
    { fmt: 'webm', ext: '.webm', magic: [0x1a, 0x45, 0xdf, 0xa3], video: true }, // EBML
    { fmt: 'm4a', ext: '.m4a', magic: null, video: false },
    { fmt: 'mp3', ext: '.mp3', magic: null, video: false },
    { fmt: 'gif', ext: '.gif', magic: [0x47, 0x49, 0x46, 0x38], video: false }, // "GIF8"
  ];

  for (const { fmt, ext, magic, video } of CASES) {
    test(`MP4 → ${fmt.toUpperCase()} (ffmpeg)`, async ({ page }) => {
      test.slow(); // wasm encode path
      await page.setInputFiles('#compressor input[type=file]', fixture('e2e-4s.mp4'));
      await selectFormat(page, fmt);
      // video formats keep the size control; audio/gif use their own defaults.
      if (video) await page.locator('input[name="target-mb"][value="8"]').check();
      await page.getByRole('button', { name: 'Compress video' }).click();

      const out = await awaitResult(page, 600_000);
      expect(out.engineLine).toContain('compatibility mode');
      expect(out.outBytes).toBeGreaterThan(1000);

      const info = await downloadInfo(page);
      expect(info.name.endsWith(ext), `download name ${info.name}`).toBe(true);
      if (magic) expect(info.magic).toEqual(magic);
    });
  }
});
