// Generates the 1200x630 social share card for every page x locale into
// public/og/<pageId>-<locale>.png. Run locally after adding/renaming pages
// (`npm run og:gen`) and commit the PNGs — Cloudflare Pages has no Chrome,
// so these are build inputs, not build outputs. vite-plugin-pages warns at
// build time if a page is missing its card.
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { PAGES, SITE_NAME } from '../src/config.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'og');

// Card-only strings. These are baked into PNGs at build time, not rendered
// UI, so they live here rather than in content/ (which feeds live pages).
const PILLS = {
  en: ['100% in your browser', 'Nothing is uploaded', 'Free · No signup'],
  cs: ['100% ve vašem prohlížeči', 'Nic se nenahrává', 'Zdarma · Bez registrace'],
};

const readJson = (file) => JSON.parse(readFileSync(join(ROOT, 'content', file), 'utf8'));

function titleFor(pageId, locale) {
  const dict = readJson(`${pageId}.${locale}.json`);
  const raw = dict['og.title'] ?? dict['meta.title'] ?? SITE_NAME;
  return raw.replace(/\{\{\s*SITE_NAME\s*\}\}/g, SITE_NAME);
}

// Same visual language as the site: dark surface, blueprint grid, owned teal.
const cardHtml = (title, locale) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #0b1014; color: #e8eef4;
    background-image:
      radial-gradient(1000px 560px at 88% -10%, rgba(20, 184, 166, 0.16), transparent 62%),
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: auto, 48px 48px, 48px 48px;
    display: flex; flex-direction: column;
    padding: 64px 72px;
  }
  .brand { display: flex; align-items: center; gap: 20px; }
  .mark {
    width: 64px; height: 64px; border-radius: 15px; background: #0c8e84;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 10px 30px rgba(20, 184, 166, 0.25);
  }
  .mark svg { width: 40px; height: 40px; }
  .brand b { font-size: 40px; letter-spacing: -0.02em; }
  h1 {
    margin-top: auto;
    font-size: ${title.length > 42 ? 68 : 78}px;
    line-height: 1.08; letter-spacing: -0.025em; font-weight: 750;
    max-width: 1010px;
  }
  .pills { display: flex; gap: 16px; margin-top: 44px; }
  .pill {
    display: flex; align-items: center; gap: 12px;
    border: 2px solid rgba(45, 212, 191, 0.45); border-radius: 999px;
    padding: 14px 26px; font-size: 27px; font-weight: 600; color: #7edcd2;
    background: rgba(20, 184, 166, 0.08);
  }
  .pill svg { width: 26px; height: 26px; flex: none; }
  .domain {
    position: absolute; right: 72px; top: 78px;
    font-size: 30px; font-weight: 650; color: #9aa7b4; letter-spacing: -0.01em;
  }
</style></head>
<body>
  <div class="brand">
    <span class="mark">
      <svg viewBox="0 0 24 24" fill="none"><path d="M8 6.5v11l9-5.5-9-5.5Z" fill="#fff"/></svg>
    </span>
    <b>${SITE_NAME}</b>
  </div>
  <span class="domain">vidkit.eu</span>
  <h1>${title}</h1>
  <div class="pills">
    ${PILLS[locale]
      .map(
        (p) => `<span class="pill">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#2dd4bf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${p}</span>`,
      )
      .join('\n')}
  </div>
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

for (const def of PAGES) {
  for (const locale of def.locales) {
    const title = titleFor(def.id, locale);
    await page.setContent(cardHtml(title, locale), { waitUntil: 'networkidle' });
    const file = join(OUT_DIR, `${def.id}-${locale}.png`);
    await page.screenshot({ path: file, type: 'png' });
    console.log(`og: ${def.id}-${locale}.png — "${title}"`);
  }
}

await browser.close();
