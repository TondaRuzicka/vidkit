// Single source of truth for branding. Changing the name or domain later
// must touch only this file — titles, canonicals and sitemap all read it.
export const SITE_NAME = 'VidKit';
export const SITE_URL = 'https://vidkit.eu';

// --- i18n registry -------------------------------------------------------
// One source of truth for languages and pages. The build plugin reads this
// to generate every locale variant, the sitemap, and hreflang alternates.
// The default locale lives at the root (/); others get a prefix (/cs/...).
export const LOCALES = ['en', 'cs'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

// Pages rendered from templates/ + content/. Slugs are per-locale so the URL
// keyword is localized too ('' is the home page). `locales` lists which
// translations exist; every listed locale must have an entry in `slugs`.
export interface PageDef {
  readonly id: string; // content file basename and @meta/@render id
  readonly slugs: Record<Locale, string>; // url segment per locale ('' = home)
  readonly template: string; // templates/<template>.html
  readonly locales: readonly Locale[];
}
export const PAGES: readonly PageDef[] = [
  { id: 'home', template: 'home', locales: ['en', 'cs'], slugs: { en: '', cs: '' } },
  {
    id: 'cv',
    template: 'cv',
    locales: ['en', 'cs'],
    slugs: { en: 'compress-video', cs: 'zmensit-video' },
  },
  {
    id: 'cv25',
    template: 'cv25',
    locales: ['en', 'cs'],
    slugs: { en: 'compress-video-to-25mb', cs: 'zmensit-video-na-25-mb' },
  },
  {
    id: 'cv10',
    template: 'cv10',
    locales: ['en', 'cs'],
    slugs: { en: 'compress-video-to-10mb', cs: 'zmensit-video-na-10-mb' },
  },
  {
    id: 'cvwa',
    template: 'cvwa',
    locales: ['en', 'cs'],
    slugs: { en: 'compress-video-for-whatsapp', cs: 'zmensit-video-pro-whatsapp' },
  },
  // Conversion landing pages — all share the `convert` template; the target
  // output format is set per page via content (convert.format → data-locked-format).
  { id: 'mov2mp4', template: 'convert', locales: ['en', 'cs'], slugs: { en: 'mov-to-mp4', cs: 'mov-na-mp4' } },
  { id: 'webm2mp4', template: 'convert', locales: ['en', 'cs'], slugs: { en: 'webm-to-mp4', cs: 'webm-na-mp4' } },
  { id: 'mkv2mp4', template: 'convert', locales: ['en', 'cs'], slugs: { en: 'mkv-to-mp4', cs: 'mkv-na-mp4' } },
  { id: 'avi2mp4', template: 'convert', locales: ['en', 'cs'], slugs: { en: 'avi-to-mp4', cs: 'avi-na-mp4' } },
  { id: 'mp42webm', template: 'convert', locales: ['en', 'cs'], slugs: { en: 'mp4-to-webm', cs: 'mp4-na-webm' } },
  { id: 'mp42mp3', template: 'convert', locales: ['en', 'cs'], slugs: { en: 'mp4-to-mp3', cs: 'mp4-na-mp3' } },
  { id: 'mp42gif', template: 'convert', locales: ['en', 'cs'], slugs: { en: 'mp4-to-gif', cs: 'mp4-na-gif' } },
];

// English-only pages still authored as standalone HTML (none right now). Listed
// in the sitemap; migrate any such page to PAGES once templatised + translated.
export const LEGACY_EN_PATHS: readonly string[] = [];

// Canonical path for a slug in a given locale. Default locale: no prefix.
export function pathFor(slug: string, locale: Locale): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  const tail = slug ? `/${slug}/` : '/';
  return `${prefix}${tail}`;
}

// Canonical path for a page in a given locale, using its localized slug.
export function pagePath(page: PageDef, locale: Locale): string {
  return pathFor(page.slugs[locale], locale);
}
