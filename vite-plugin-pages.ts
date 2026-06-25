import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import {
  DEFAULT_LOCALE,
  LEGACY_EN_PATHS,
  LOCALES,
  PAGES,
  SITE_NAME,
  SITE_URL,
  pathFor,
  type Locale,
  type PageDef,
} from './src/config';

const ROOT = resolve(import.meta.dirname);
const PARTIALS_DIR = join(ROOT, 'partials');
const TEMPLATES_DIR = join(ROOT, 'templates');
const CONTENT_DIR = join(ROOT, 'content');

function include(html: string): string {
  return html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name: string) =>
    include(readFileSync(join(PARTIALS_DIR, `${name}.html`), 'utf8')),
  );
}

const readJson = (file: string): Record<string, string> =>
  JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'));

// Merged dictionary for a page+locale: site vars + shared (common) strings +
// page-specific strings. Page keys win over common, common over site vars.
function dictFor(pageId: string | null, locale: Locale): Record<string, string> {
  const dict: Record<string, string> = { SITE_NAME, SITE_URL };
  Object.assign(dict, readJson(`common.${locale}.json`));
  if (pageId) Object.assign(dict, readJson(`${pageId}.${locale}.json`));
  return dict;
}

// Resolve {{key}} placeholders from the dictionary. Runs twice so values that
// themselves contain placeholders (e.g. brand name inside a sentence) resolve.
function substitute(html: string, dict: Record<string, string>): string {
  const pass = (s: string) =>
    s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) =>
      key in dict ? dict[key]! : m,
    );
  return pass(pass(html));
}

function findPage(id: string): PageDef | undefined {
  return PAGES.find((p) => p.id === id);
}

// <title>, description, canonical, og tags and hreflang alternates for a page.
// Values stay as {{placeholders}} — filled by the later substitute() pass.
function metaBlock(page: PageDef, locale: Locale): string {
  const self = `${SITE_URL}${pathFor(page.slug, locale)}`;
  const alternates = page.locales
    .map(
      (l) =>
        `<link rel="alternate" hreflang="${l}" href="${SITE_URL}${pathFor(page.slug, l)}" />`,
    )
    .join('\n');
  const xDefault = `<link rel="alternate" hreflang="x-default" href="${SITE_URL}${pathFor(page.slug, DEFAULT_LOCALE)}" />`;
  return [
    `<title>{{meta.title}}</title>`,
    `<meta name="description" content="{{meta.description}}" />`,
    `<link rel="canonical" href="${self}" />`,
    `<meta property="og:title" content="{{og.title}}" />`,
    `<meta property="og:description" content="{{og.description}}" />`,
    `<meta property="og:url" content="${self}" />`,
    alternates,
    xDefault,
  ].join('\n');
}

// Language switcher: links to this page in every available locale.
function langSwitch(page: PageDef, current: Locale): string {
  const links = page.locales
    .map((l) => {
      const href = pathFor(page.slug, l);
      const label = l.toUpperCase();
      const aria = l === current ? ' aria-current="true"' : '';
      return `<a hreflang="${l}" lang="${l}" href="${href}"${aria}>${label}</a>`;
    })
    .join('');
  return `<div class="lang-switch" role="group" aria-label="Language">${links}</div>`;
}

const stripTags = (s: string) =>
  s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Builds FAQPage JSON-LD from the visible <details class="faq-item"> markup,
// so the structured data can never drift from what the page shows.
function faqJsonLd(html: string): string | null {
  const items = [
    ...html.matchAll(
      /<details class="faq-item">\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g,
    ),
  ];
  if (items.length === 0) return null;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([, q, a]) => ({
      '@type': 'Question',
      name: stripTags(q!),
      acceptedAnswer: { '@type': 'Answer', text: stripTags(a!) },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}

// Full transform for one entry HTML file. Self-describing via directives:
//   <!-- @meta <pageId> <locale> -->   head: title/meta/canonical/hreflang
//   <!-- @render <pageId> <locale> --> body: the page template
//   <!-- @langswitch -->               language switcher (in shared header)
// Legacy pages carry no directives: they resolve common.<default> strings only
// so their shared partials still fill in, and get no switcher.
function render(rawHtml: string): string {
  let html = include(rawHtml);

  const ctx = html.match(/<!--\s*@(?:meta|render)\s+([\w-]+)\s+([\w-]+)\s*-->/);
  const pageId = ctx ? ctx[1]! : null;
  const locale: Locale =
    ctx && (LOCALES as readonly string[]).includes(ctx[2]!)
      ? (ctx[2] as Locale)
      : DEFAULT_LOCALE;
  const page = pageId ? findPage(pageId) : undefined;

  html = html.replace(/<!--\s*@meta\s+[\w-]+\s+[\w-]+\s*-->/g, () =>
    page ? metaBlock(page, locale) : '',
  );
  html = html.replace(/<!--\s*@render\s+[\w-]+\s+[\w-]+\s*-->/g, () =>
    page ? readFileSync(join(TEMPLATES_DIR, `${page.template}.html`), 'utf8') : '',
  );
  html = html.replace(/<!--\s*@langswitch\s*-->/g, () =>
    page ? langSwitch(page, locale) : '',
  );

  html = substitute(html, dictFor(pageId, locale));

  const ld = faqJsonLd(html);
  if (ld) html = html.replace('</head>', `${ld}\n</head>`);
  return html;
}

const allPaths = (): string[] => [
  ...PAGES.flatMap((p) => p.locales.map((l) => pathFor(p.slug, l))),
  ...LEGACY_EN_PATHS,
];

const sitemap = () =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allPaths()
    .map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`)
    .join('\n')}\n</urlset>\n`;

const robots = () =>
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

export default function pages(): Plugin {
  return {
    name: 'vidkit-pages',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots() });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sitemap.xml') {
          res.setHeader('Content-Type', 'application/xml');
          res.end(sitemap());
        } else if (req.url === '/robots.txt') {
          res.setHeader('Content-Type', 'text/plain');
          res.end(robots());
        } else next();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return render(html);
      },
    },
    handleHotUpdate({ file, server }) {
      if (
        file.startsWith(PARTIALS_DIR) ||
        file.startsWith(TEMPLATES_DIR) ||
        file.startsWith(CONTENT_DIR)
      ) {
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
