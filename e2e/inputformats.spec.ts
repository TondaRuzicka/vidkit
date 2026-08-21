import { expect, test, type Page } from '@playwright/test';
import { awaitResult, downloadInfo, fixture } from './helpers';

// Every converter landing page must actually do the thing it ranks for. These
// tests drive each page the way a searcher arrives at it — drop the format in
// the URL, expect the format in the URL out — so a decode regression fails here
// rather than on a live page. The legacy containers (wmv/flv/vob/3gp) can't be
// parsed by mediabunny and fall through to the ffmpeg probe; ts/m4v stay on the
// fast path.

/** Drop a file on a locked-format landing page and return the finished result. */
async function convertOn(page: Page, path: string, file: string) {
  await page.goto(path);
  // Locked pages must not offer a format selector.
  await expect(page.locator('input[name="output-format"]')).toHaveCount(0);
  await page.setInputFiles('#compressor input[type=file]', fixture(file));
  const target = page.locator('input[name="target-mb"][value="8"]');
  if (await target.isVisible()) await target.check();
  await page.getByRole('button', { name: 'Convert' }).click();
  return awaitResult(page, 600_000);
}

/** ISOBMFF stamps 'ftyp' at offset 4 — proof the file was rebuilt, not echoed. */
async function boxType(page: Page): Promise<string> {
  return page.locator('a.result-download').evaluate(async (a) => {
    const buf = await (await fetch((a as HTMLAnchorElement).href)).arrayBuffer();
    return new TextDecoder().decode(new Uint8Array(buf).slice(4, 8));
  });
}

const TO_MP4 = [
  { path: '/wmv-to-mp4/', file: 'e2e-4s.wmv', label: 'WMV (ASF)' },
  { path: '/flv-to-mp4/', file: 'e2e-4s.flv', label: 'FLV (Flash)' },
  { path: '/vob-to-mp4/', file: 'e2e-4s.vob', label: 'VOB (DVD)' },
  { path: '/ts-to-mp4/', file: 'e2e-4s.ts', label: 'TS (transport stream)' },
  { path: '/3gp-to-mp4/', file: 'e2e-4s.3gp', label: '3GP (early phone)' },
  { path: '/m4v-to-mp4/', file: 'e2e-4s.m4v', label: 'M4V (Apple)' },
];

test.describe('converter landing pages produce MP4', () => {
  for (const { path, file, label } of TO_MP4) {
    test(`${path} converts ${label}`, async ({ page }) => {
      test.slow(); // legacy containers use the wasm path
      const out = await convertOn(page, path, file);
      expect(out.outBytes, 'produced a real file').toBeGreaterThan(10_000);
      expect((await downloadInfo(page)).name.endsWith('.mp4')).toBe(true);
      expect(await boxType(page), `${label} output is ISOBMFF`).toBe('ftyp');
    });
  }
});

// Claims made in the FAQ copy on those two pages; if either stops converting,
// the copy is wrong and has to change with the code.
test.describe('related extensions promised in FAQ copy', () => {
  test('/ts-to-mp4/ handles an AVCHD .m2ts', async ({ page }) => {
    test.slow();
    const out = await convertOn(page, '/ts-to-mp4/', 'e2e-4s.m2ts');
    expect(out.outBytes).toBeGreaterThan(10_000);
    expect(await boxType(page)).toBe('ftyp');
  });

  test('/3gp-to-mp4/ handles a .3g2', async ({ page }) => {
    test.slow();
    const out = await convertOn(page, '/3gp-to-mp4/', 'e2e-4s.3g2');
    expect(out.outBytes).toBeGreaterThan(10_000);
    expect(await boxType(page)).toBe('ftyp');
  });
});

test.describe('MP4 to other containers', () => {
  const CASES = [
    { path: '/mp4-to-mov/', ext: '.mov', magic: null },
    { path: '/mp4-to-mkv/', ext: '.mkv', magic: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML
  ];
  for (const { path, ext, magic } of CASES) {
    test(`${path} outputs ${ext}`, async ({ page }) => {
      const out = await convertOn(page, path, 'e2e-4s.mp4');
      expect(out.outBytes).toBeGreaterThan(10_000);
      const info = await downloadInfo(page);
      expect(info.name.endsWith(ext), `download name ${info.name}`).toBe(true);
      if (magic) expect(info.magic).toEqual(magic);
    });
  }
});
