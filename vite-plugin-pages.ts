import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { SITE_NAME, SITE_URL } from './src/config';

const PARTIALS_DIR = resolve(import.meta.dirname, 'partials');

function include(html: string): string {
  return html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name: string) =>
    include(readFileSync(join(PARTIALS_DIR, `${name}.html`), 'utf8')),
  );
}

function vars(html: string): string {
  return html
    .replaceAll('{{SITE_NAME}}', SITE_NAME)
    .replaceAll('{{SITE_URL}}', SITE_URL);
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

const PAGE_PATHS = [
  '/',
  '/compress-video/',
  '/compress-video-to-25mb/',
  '/compress-video-to-10mb/',
  '/compress-video-for-whatsapp/',
];

const sitemap = () =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGE_PATHS.map(
    (p) => `  <url><loc>${SITE_URL}${p}</loc></url>`,
  ).join('\n')}\n</urlset>\n`;

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
        let out = vars(include(html));
        const ld = faqJsonLd(out);
        if (ld) out = out.replace('</head>', `${ld}\n</head>`);
        return out;
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(PARTIALS_DIR)) {
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
