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

// Pages rendered from templates/ + content/. `slug` '' is the home page.
// `locales` lists which translations exist — add a locale here once its
// content file is written and the page will be generated + linked.
export interface PageDef {
  readonly id: string; // content file basename and @meta/@render id
  readonly slug: string; // url segment ('' = home)
  readonly template: string; // templates/<template>.html
  readonly locales: readonly Locale[];
}
export const PAGES: readonly PageDef[] = [
  { id: 'home', slug: '', template: 'home', locales: ['en', 'cs'] },
  { id: 'cv', slug: 'compress-video', template: 'cv', locales: ['en', 'cs'] },
  { id: 'cv25', slug: 'compress-video-to-25mb', template: 'cv25', locales: ['en', 'cs'] },
  { id: 'cv10', slug: 'compress-video-to-10mb', template: 'cv10', locales: ['en', 'cs'] },
  { id: 'cvwa', slug: 'compress-video-for-whatsapp', template: 'cvwa', locales: ['en', 'cs'] },
];

// English-only pages still authored as standalone HTML (none right now). Listed
// in the sitemap; migrate any such page to PAGES once templatised + translated.
export const LEGACY_EN_PATHS: readonly string[] = [];

// Canonical path for a page in a given locale. Default locale: no prefix.
export function pathFor(slug: string, locale: Locale): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  const tail = slug ? `/${slug}/` : '/';
  return `${prefix}${tail}`;
}
