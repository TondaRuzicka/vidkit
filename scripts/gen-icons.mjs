// Renders the install icons the web app manifest points at, from the one
// favicon.svg, into public/icons/. Run locally (`npm run icons:gen`) and
// commit the PNGs — like the share cards, Cloudflare Pages has no Chrome, so
// these are build inputs. The maskable variant keeps the mark inside the
// safe zone (80% of the canvas) that Android's adaptive icons crop to.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const svg = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf8');
const fill = svg.match(/rect[^>]*fill="(#[0-9a-f]{6})"/i)?.[1] ?? '#2563eb';

// [file, canvas px, mark px, background]. Plain icons fill the canvas
// (rounded corners come from the SVG); maskable ones sit on a solid square
// so nothing important is lost when the OS masks them into a circle.
const JOBS = [
  ['icon-180.png', 180, 180, 'transparent'],
  ['icon-192.png', 192, 192, 'transparent'],
  ['icon-512.png', 512, 512, 'transparent'],
  ['maskable-512.png', 512, 410, fill],
];

const html = (size, mark, bg) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${size}px;height:${size}px;background:${bg};overflow:hidden}
  body{display:flex;align-items:center;justify-content:center}
  svg{width:${mark}px;height:${mark}px;display:block}
</style></head><body>${svg}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [file, size, mark, bg] of JOBS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size, mark, bg));
  const png = await page.screenshot({ omitBackground: bg === 'transparent', type: 'png' });
  writeFileSync(join(OUT, file), png);
  console.log('icon:', file);
}
await browser.close();
