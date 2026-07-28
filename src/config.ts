// Single source of truth for branding. Changing the name or domain later
// must touch only this file — titles, canonicals and sitemap all read it.
export const SITE_NAME = 'VidKit';
export const SITE_URL = 'https://vidkit.eu';

// --- i18n registry -------------------------------------------------------
// One source of truth for languages and pages. The build plugin reads this
// to generate every locale variant, the sitemap, and hreflang alternates.
// The default locale lives at the root (/); others get a prefix (/cs/...).
export const LOCALES = ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

// BCP 47 tag for <html lang> and hreflang. Usually identical to the locale
// key; Chinese needs the script subtag, because `zh` alone doesn't say whether
// the copy is Simplified or Traditional. Ours is Simplified, so it ships as
// zh-Hans — which also leaves room to add zh-Hant later without the two
// variants competing for the same hreflang slot.
export const HREFLANG: Record<Locale, string> = {
  en: 'en',
  cs: 'cs',
  es: 'es',
  pt: 'pt',
  de: 'de',
  tr: 'tr',
  zh: 'zh-Hans',
};

// Pages rendered from templates/ + content/. Slugs are per-locale so the URL
// keyword is localized too ('' is the home page). `locales` lists which
// translations exist; every listed locale must have an entry in `slugs`.
// Chinese slugs are pinyin: Google handles percent-encoded Han characters,
// but ASCII paths survive copy-paste, backlinks and analytics intact, and a
// Chinese searcher never types the URL keyword anyway.
export interface PageDef {
  readonly id: string; // content file basename and @meta/@render id
  readonly slugs: Record<Locale, string>; // url segment per locale ('' = home)
  readonly template: string; // templates/<template>.html
  readonly locales: readonly Locale[];
}
export const PAGES: readonly PageDef[] = [
  { id: 'home', template: 'home', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: '', cs: '', es: '', pt: '', de: '', tr: '', zh: '' } },
  {
    id: 'cv',
    template: 'cv',
    locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'],
    slugs: { en: 'compress-video', cs: 'zmensit-video', es: 'comprimir-video', pt: 'comprimir-video', de: 'video-komprimieren', tr: 'video-sikistirma', zh: 'shipin-yasuo' },
  },
  {
    id: 'cv25',
    template: 'cv25',
    locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'],
    slugs: { en: 'compress-video-to-25mb', cs: 'zmensit-video-na-25-mb', es: 'comprimir-video-a-25-mb', pt: 'comprimir-video-para-25-mb', de: 'video-auf-25-mb-komprimieren', tr: 'video-25-mb-sikistirma', zh: 'shipin-yasuo-25mb' },
  },
  {
    id: 'cv10',
    template: 'cv10',
    locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'],
    slugs: { en: 'compress-video-to-10mb', cs: 'zmensit-video-na-10-mb', es: 'comprimir-video-a-10-mb', pt: 'comprimir-video-para-10-mb', de: 'video-auf-10-mb-komprimieren', tr: 'video-10-mb-sikistirma', zh: 'shipin-yasuo-10mb' },
  },
  {
    id: 'cvwa',
    template: 'cvwa',
    locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'],
    slugs: { en: 'compress-video-for-whatsapp', cs: 'zmensit-video-pro-whatsapp', es: 'comprimir-video-para-whatsapp', pt: 'comprimir-video-para-whatsapp', de: 'video-fuer-whatsapp-komprimieren', tr: 'whatsapp-icin-video-sikistirma', zh: 'whatsapp-shipin-yasuo' },
  },
  // Conversion landing pages — all share the `convert` template; the target
  // output format is set per page via content (convert.format → data-locked-format).
  { id: 'mov2mp4', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mov-to-mp4', cs: 'mov-na-mp4', es: 'mov-a-mp4', pt: 'mov-para-mp4', de: 'mov-in-mp4', tr: 'mov-mp4-donusturucu', zh: 'mov-zhuan-mp4' } },
  { id: 'webm2mp4', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'webm-to-mp4', cs: 'webm-na-mp4', es: 'webm-a-mp4', pt: 'webm-para-mp4', de: 'webm-in-mp4', tr: 'webm-mp4-donusturucu', zh: 'webm-zhuan-mp4' } },
  { id: 'mkv2mp4', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mkv-to-mp4', cs: 'mkv-na-mp4', es: 'mkv-a-mp4', pt: 'mkv-para-mp4', de: 'mkv-in-mp4', tr: 'mkv-mp4-donusturucu', zh: 'mkv-zhuan-mp4' } },
  { id: 'avi2mp4', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'avi-to-mp4', cs: 'avi-na-mp4', es: 'avi-a-mp4', pt: 'avi-para-mp4', de: 'avi-in-mp4', tr: 'avi-mp4-donusturucu', zh: 'avi-zhuan-mp4' } },
  { id: 'mp42webm', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mp4-to-webm', cs: 'mp4-na-webm', es: 'mp4-a-webm', pt: 'mp4-para-webm', de: 'mp4-in-webm', tr: 'mp4-webm-donusturucu', zh: 'mp4-zhuan-webm' } },
  { id: 'mp42mp3', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mp4-to-mp3', cs: 'mp4-na-mp3', es: 'mp4-a-mp3', pt: 'mp4-para-mp3', de: 'mp4-in-mp3', tr: 'mp4-mp3-donusturucu', zh: 'mp4-zhuan-mp3' } },
  { id: 'mp42gif', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mp4-to-gif', cs: 'mp4-na-gif', es: 'mp4-a-gif', pt: 'mp4-para-gif', de: 'mp4-in-gif', tr: 'mp4-gif-donusturucu', zh: 'mp4-zhuan-gif' } },
  // Audio-extraction cluster — English-only (CZ keyword data: Czech converter
  // slugs have ~0 volume; English pages serve Czech + global searchers).
  { id: 'mov2mp3', template: 'convert', locales: ['en'], slugs: { en: 'mov-to-mp3', cs: 'mov-to-mp3', es: 'mov-to-mp3', pt: 'mov-to-mp3', de: 'mov-to-mp3', tr: 'mov-to-mp3', zh: 'mov-to-mp3' } },
  // Audio-only inputs — supported since the probe accepts no-video-track files.
  { id: 'm4a2mp3', template: 'convert', locales: ['en'], slugs: { en: 'm4a-to-mp3', cs: 'm4a-to-mp3', es: 'm4a-to-mp3', pt: 'm4a-to-mp3', de: 'm4a-to-mp3', tr: 'm4a-to-mp3', zh: 'm4a-to-mp3' } },
  { id: 'wav2mp3', template: 'convert', locales: ['en'], slugs: { en: 'wav-to-mp3', cs: 'wav-to-mp3', es: 'wav-to-mp3', pt: 'wav-to-mp3', de: 'wav-to-mp3', tr: 'wav-to-mp3', zh: 'wav-to-mp3' } },
  // Video→mp3 (audio extraction). video-to-mp3 replaces the old 301 to mp4-to-mp3.
  { id: 'mkv2mp3', template: 'convert', locales: ['en'], slugs: { en: 'mkv-to-mp3', cs: 'mkv-to-mp3', es: 'mkv-to-mp3', pt: 'mkv-to-mp3', de: 'mkv-to-mp3', tr: 'mkv-to-mp3', zh: 'mkv-to-mp3' } },
  { id: 'webm2mp3', template: 'convert', locales: ['en'], slugs: { en: 'webm-to-mp3', cs: 'webm-to-mp3', es: 'webm-to-mp3', pt: 'webm-to-mp3', de: 'webm-to-mp3', tr: 'webm-to-mp3', zh: 'webm-to-mp3' } },
  { id: 'video2mp3', template: 'convert', locales: ['en'], slugs: { en: 'video-to-mp3', cs: 'video-to-mp3', es: 'video-to-mp3', pt: 'video-to-mp3', de: 'video-to-mp3', tr: 'video-to-mp3', zh: 'video-to-mp3' } },
  { id: 'extractaudio', template: 'convert', locales: ['en'], slugs: { en: 'extract-audio-from-video', cs: 'extract-audio-from-video', es: 'extract-audio-from-video', pt: 'extract-audio-from-video', de: 'extract-audio-from-video', tr: 'extract-audio-from-video', zh: 'extract-audio-from-video' } },
  // Reference content (linkable assets) — no compressor widget.
  { id: 'limits', template: 'limits', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'video-upload-size-limits', cs: 'limity-velikosti-videa', es: 'limites-de-tamano-de-video', pt: 'limites-de-tamanho-de-video', de: 'video-groessenlimits', tr: 'video-boyut-limitleri', zh: 'shipin-shangchuan-daxiao-xianzhi' } },
  { id: 'calc', template: 'calculator', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'video-bitrate-calculator', cs: 'kalkulacka-datoveho-toku', es: 'calculadora-de-bitrate-de-video', pt: 'calculadora-de-bitrate-de-video', de: 'video-bitrate-rechner', tr: 'video-bitrate-hesaplayici', zh: 'shipin-matelv-jisuanqi' } },
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
