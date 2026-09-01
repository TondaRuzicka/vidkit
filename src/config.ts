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

// Groups a page for the hub index, the related-tools block and breadcrumbs.
// 'hub' pages are the category landing pages themselves; 'home' has none.
export type PageCategory = 'compress' | 'convert' | 'audio' | 'edit' | 'reference' | 'hub';

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
  /** Omitted only for the home page. Drives @toolindex / @related grouping. */
  readonly category?: PageCategory;
  /**
   * Other pages' content files to merge in under this page's dictionary
   * (between common and the page's own keys). Lets a page quote figures from
   * a single source — the platform limit pages read `limits` so a number can
   * only ever be changed in one place per locale.
   */
  readonly sharedContent?: readonly string[];
}
export const PAGES: readonly PageDef[] = [
  { id: 'home', template: 'home', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: '', cs: '', es: '', pt: '', de: '', tr: '', zh: '' } },
  {
    id: 'cv', category: 'compress',
    template: 'cv',
    locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'],
    slugs: { en: 'compress-video', cs: 'zmensit-video', es: 'comprimir-video', pt: 'comprimir-video', de: 'video-komprimieren', tr: 'video-sikistirma', zh: 'shipin-yasuo' },
  },
  {
    id: 'cv25', category: 'compress',
    template: 'cv25',
    locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'],
    slugs: { en: 'compress-video-to-25mb', cs: 'zmensit-video-na-25-mb', es: 'comprimir-video-a-25-mb', pt: 'comprimir-video-para-25-mb', de: 'video-auf-25-mb-komprimieren', tr: 'video-25-mb-sikistirma', zh: 'shipin-yasuo-25mb' },
  },
  {
    id: 'cv10', category: 'compress',
    template: 'cv10',
    locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'],
    slugs: { en: 'compress-video-to-10mb', cs: 'zmensit-video-na-10-mb', es: 'comprimir-video-a-10-mb', pt: 'comprimir-video-para-10-mb', de: 'video-auf-10-mb-komprimieren', tr: 'video-10-mb-sikistirma', zh: 'shipin-yasuo-10mb' },
  },
  {
    id: 'cvwa', category: 'compress',
    template: 'cvwa',
    locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'],
    slugs: { en: 'compress-video-for-whatsapp', cs: 'zmensit-video-pro-whatsapp', es: 'comprimir-video-para-whatsapp', pt: 'comprimir-video-para-whatsapp', de: 'video-fuer-whatsapp-komprimieren', tr: 'whatsapp-icin-video-sikistirma', zh: 'whatsapp-shipin-yasuo' },
  },
  // Conversion landing pages — all share the `convert` template; the target
  // output format is set per page via content (convert.format → data-locked-format).
  { id: 'mov2mp4', category: 'convert', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mov-to-mp4', cs: 'mov-na-mp4', es: 'mov-a-mp4', pt: 'mov-para-mp4', de: 'mov-in-mp4', tr: 'mov-mp4-donusturucu', zh: 'mov-zhuan-mp4' } },
  { id: 'webm2mp4', category: 'convert', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'webm-to-mp4', cs: 'webm-na-mp4', es: 'webm-a-mp4', pt: 'webm-para-mp4', de: 'webm-in-mp4', tr: 'webm-mp4-donusturucu', zh: 'webm-zhuan-mp4' } },
  { id: 'mkv2mp4', category: 'convert', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mkv-to-mp4', cs: 'mkv-na-mp4', es: 'mkv-a-mp4', pt: 'mkv-para-mp4', de: 'mkv-in-mp4', tr: 'mkv-mp4-donusturucu', zh: 'mkv-zhuan-mp4' } },
  { id: 'avi2mp4', category: 'convert', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'avi-to-mp4', cs: 'avi-na-mp4', es: 'avi-a-mp4', pt: 'avi-para-mp4', de: 'avi-in-mp4', tr: 'avi-mp4-donusturucu', zh: 'avi-zhuan-mp4' } },
  { id: 'mp42webm', category: 'convert', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mp4-to-webm', cs: 'mp4-na-webm', es: 'mp4-a-webm', pt: 'mp4-para-webm', de: 'mp4-in-webm', tr: 'mp4-webm-donusturucu', zh: 'mp4-zhuan-webm' } },
  { id: 'mp42mp3', category: 'audio', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mp4-to-mp3', cs: 'mp4-na-mp3', es: 'mp4-a-mp3', pt: 'mp4-para-mp3', de: 'mp4-in-mp3', tr: 'mp4-mp3-donusturucu', zh: 'mp4-zhuan-mp3' } },
  { id: 'mp42gif', category: 'convert', template: 'convert', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'mp4-to-gif', cs: 'mp4-na-gif', es: 'mp4-a-gif', pt: 'mp4-para-gif', de: 'mp4-in-gif', tr: 'mp4-gif-donusturucu', zh: 'mp4-zhuan-gif' } },
  // Audio-extraction cluster — English-only (CZ keyword data: Czech converter
  // slugs have ~0 volume; English pages serve Czech + global searchers).
  { id: 'mov2mp3', category: 'audio', template: 'convert', locales: ['en'], slugs: { en: 'mov-to-mp3', cs: 'mov-to-mp3', es: 'mov-to-mp3', pt: 'mov-to-mp3', de: 'mov-to-mp3', tr: 'mov-to-mp3', zh: 'mov-to-mp3' } },
  // Audio-only inputs — supported since the probe accepts no-video-track files.
  { id: 'm4a2mp3', category: 'audio', template: 'convert', locales: ['en'], slugs: { en: 'm4a-to-mp3', cs: 'm4a-to-mp3', es: 'm4a-to-mp3', pt: 'm4a-to-mp3', de: 'm4a-to-mp3', tr: 'm4a-to-mp3', zh: 'm4a-to-mp3' } },
  { id: 'wav2mp3', category: 'audio', template: 'convert', locales: ['en'], slugs: { en: 'wav-to-mp3', cs: 'wav-to-mp3', es: 'wav-to-mp3', pt: 'wav-to-mp3', de: 'wav-to-mp3', tr: 'wav-to-mp3', zh: 'wav-to-mp3' } },
  // Video→mp3 (audio extraction). video-to-mp3 replaces the old 301 to mp4-to-mp3.
  { id: 'mkv2mp3', category: 'audio', template: 'convert', locales: ['en'], slugs: { en: 'mkv-to-mp3', cs: 'mkv-to-mp3', es: 'mkv-to-mp3', pt: 'mkv-to-mp3', de: 'mkv-to-mp3', tr: 'mkv-to-mp3', zh: 'mkv-to-mp3' } },
  { id: 'webm2mp3', category: 'audio', template: 'convert', locales: ['en'], slugs: { en: 'webm-to-mp3', cs: 'webm-to-mp3', es: 'webm-to-mp3', pt: 'webm-to-mp3', de: 'webm-to-mp3', tr: 'webm-to-mp3', zh: 'webm-to-mp3' } },
  { id: 'video2mp3', category: 'audio', template: 'convert', locales: ['en'], slugs: { en: 'video-to-mp3', cs: 'video-to-mp3', es: 'video-to-mp3', pt: 'video-to-mp3', de: 'video-to-mp3', tr: 'video-to-mp3', zh: 'video-to-mp3' } },
  { id: 'extractaudio', category: 'audio', template: 'convert', locales: ['en'], slugs: { en: 'extract-audio-from-video', cs: 'extract-audio-from-video', es: 'extract-audio-from-video', pt: 'extract-audio-from-video', de: 'extract-audio-from-video', tr: 'extract-audio-from-video', zh: 'extract-audio-from-video' } },
  // Legacy/one-way converter long-tail — English-only, same reasoning as the
  // audio cluster. Inputs mediabunny can't parse (wmv/flv/vob/3gp) fall through
  // to the ffmpeg probe; ts/m4v stay on the fast path. All verified end-to-end
  // in e2e/inputformats.spec.ts — that spec is the guard against shipping a
  // landing page whose widget can't do the thing the page ranks for.
  { id: 'mp42mov', category: 'convert', template: 'convert', locales: ['en'], slugs: { en: 'mp4-to-mov', cs: 'mp4-to-mov', es: 'mp4-to-mov', pt: 'mp4-to-mov', de: 'mp4-to-mov', tr: 'mp4-to-mov', zh: 'mp4-to-mov' } },
  { id: 'mp42mkv', category: 'convert', template: 'convert', locales: ['en'], slugs: { en: 'mp4-to-mkv', cs: 'mp4-to-mkv', es: 'mp4-to-mkv', pt: 'mp4-to-mkv', de: 'mp4-to-mkv', tr: 'mp4-to-mkv', zh: 'mp4-to-mkv' } },
  { id: 'wmv2mp4', category: 'convert', template: 'convert', locales: ['en'], slugs: { en: 'wmv-to-mp4', cs: 'wmv-to-mp4', es: 'wmv-to-mp4', pt: 'wmv-to-mp4', de: 'wmv-to-mp4', tr: 'wmv-to-mp4', zh: 'wmv-to-mp4' } },
  { id: 'vob2mp4', category: 'convert', template: 'convert', locales: ['en'], slugs: { en: 'vob-to-mp4', cs: 'vob-to-mp4', es: 'vob-to-mp4', pt: 'vob-to-mp4', de: 'vob-to-mp4', tr: 'vob-to-mp4', zh: 'vob-to-mp4' } },
  { id: 'flv2mp4', category: 'convert', template: 'convert', locales: ['en'], slugs: { en: 'flv-to-mp4', cs: 'flv-to-mp4', es: 'flv-to-mp4', pt: 'flv-to-mp4', de: 'flv-to-mp4', tr: 'flv-to-mp4', zh: 'flv-to-mp4' } },
  { id: 'ts2mp4', category: 'convert', template: 'convert', locales: ['en'], slugs: { en: 'ts-to-mp4', cs: 'ts-to-mp4', es: 'ts-to-mp4', pt: 'ts-to-mp4', de: 'ts-to-mp4', tr: 'ts-to-mp4', zh: 'ts-to-mp4' } },
  { id: '3gp2mp4', category: 'convert', template: 'convert', locales: ['en'], slugs: { en: '3gp-to-mp4', cs: '3gp-to-mp4', es: '3gp-to-mp4', pt: '3gp-to-mp4', de: '3gp-to-mp4', tr: '3gp-to-mp4', zh: '3gp-to-mp4' } },
  { id: 'm4v2mp4', category: 'convert', template: 'convert', locales: ['en'], slugs: { en: 'm4v-to-mp4', cs: 'm4v-to-mp4', es: 'm4v-to-mp4', pt: 'm4v-to-mp4', de: 'm4v-to-mp4', tr: 'm4v-to-mp4', zh: 'm4v-to-mp4' } },
  // Editing tools — the first product line beyond compress/convert. Both
  // pages mount the same trim widget; the slugs match the two ways people
  // phrase the search. English-only for the same reason as the converters.
  { id: 'trim', category: 'edit', template: 'trim', locales: ['en'], slugs: { en: 'trim-video', cs: 'trim-video', es: 'trim-video', pt: 'trim-video', de: 'trim-video', tr: 'trim-video', zh: 'trim-video' } },
  { id: 'cut', category: 'edit', template: 'trim', locales: ['en'], slugs: { en: 'cut-video', cs: 'cut-video', es: 'cut-video', pt: 'cut-video', de: 'cut-video', tr: 'cut-video', zh: 'cut-video' } },
  // Category hubs. These exist for crawl reach as much as for search: their
  // tool lists are generated from this registry by @toolindex, so a new page
  // is linked from a hub the moment it lands here — no list to keep in sync.
  { id: 'videotools', category: 'hub', template: 'hub', locales: ['en'], slugs: { en: 'video-tools', cs: 'video-tools', es: 'video-tools', pt: 'video-tools', de: 'video-tools', tr: 'video-tools', zh: 'video-tools' } },
  { id: 'convertvideo', category: 'hub', template: 'hub', locales: ['en'], slugs: { en: 'convert-video', cs: 'convert-video', es: 'convert-video', pt: 'convert-video', de: 'convert-video', tr: 'convert-video', zh: 'convert-video' } },
  // Reference content (linkable assets) — no compressor widget.
  { id: 'limits', category: 'reference', template: 'limits', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'video-upload-size-limits', cs: 'limity-velikosti-videa', es: 'limites-de-tamano-de-video', pt: 'limites-de-tamanho-de-video', de: 'video-groessenlimits', tr: 'video-boyut-limitleri', zh: 'shipin-shangchuan-daxiao-xianzhi' } },
  // Per-platform answer pages. One question each ("what's the Discord video
  // size limit?"), answered in the title, with the compressor locked to that
  // platform's practical target. Figures come from content/limits.*.json via
  // sharedContent, never retyped. English-only except WhatsApp, whose
  // localised compress page already ranks in PT/DE/ES.
  { id: 'discord', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'discord-video-size-limit', cs: 'discord-video-size-limit', es: 'discord-video-size-limit', pt: 'discord-video-size-limit', de: 'discord-video-size-limit', tr: 'discord-video-size-limit', zh: 'discord-video-size-limit' } },
  { id: 'whatsapp', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en', 'es', 'pt', 'de'], slugs: { en: 'whatsapp-video-size-limit', cs: 'whatsapp-video-size-limit', es: 'limite-de-tamano-de-video-whatsapp', pt: 'limite-de-tamanho-de-video-whatsapp', de: 'whatsapp-video-groessenlimit', tr: 'whatsapp-video-size-limit', zh: 'whatsapp-video-size-limit' } },
  { id: 'gmail', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'gmail-video-size-limit', cs: 'gmail-video-size-limit', es: 'gmail-video-size-limit', pt: 'gmail-video-size-limit', de: 'gmail-video-size-limit', tr: 'gmail-video-size-limit', zh: 'gmail-video-size-limit' } },
  { id: 'outlook', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'outlook-attachment-size-limit-video', cs: 'outlook-attachment-size-limit-video', es: 'outlook-attachment-size-limit-video', pt: 'outlook-attachment-size-limit-video', de: 'outlook-attachment-size-limit-video', tr: 'outlook-attachment-size-limit-video', zh: 'outlook-attachment-size-limit-video' } },
  { id: 'imessage', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'imessage-video-size-limit', cs: 'imessage-video-size-limit', es: 'imessage-video-size-limit', pt: 'imessage-video-size-limit', de: 'imessage-video-size-limit', tr: 'imessage-video-size-limit', zh: 'imessage-video-size-limit' } },
  // Batch B — duration-limited platforms hand off to the trim tool instead.
  { id: 'instagram', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'instagram-reels-length-limit', cs: 'instagram-reels-length-limit', es: 'instagram-reels-length-limit', pt: 'instagram-reels-length-limit', de: 'instagram-reels-length-limit', tr: 'instagram-reels-length-limit', zh: 'instagram-reels-length-limit' } },
  { id: 'tiktok', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'tiktok-video-size-limit', cs: 'tiktok-video-size-limit', es: 'tiktok-video-size-limit', pt: 'tiktok-video-size-limit', de: 'tiktok-video-size-limit', tr: 'tiktok-video-size-limit', zh: 'tiktok-video-size-limit' } },
  { id: 'snapchat', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'snapchat-video-length-limit', cs: 'snapchat-video-length-limit', es: 'snapchat-video-length-limit', pt: 'snapchat-video-length-limit', de: 'snapchat-video-length-limit', tr: 'snapchat-video-length-limit', zh: 'snapchat-video-length-limit' } },
  { id: 'x', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'x-twitter-video-length-limit', cs: 'x-twitter-video-length-limit', es: 'x-twitter-video-length-limit', pt: 'x-twitter-video-length-limit', de: 'x-twitter-video-length-limit', tr: 'x-twitter-video-length-limit', zh: 'x-twitter-video-length-limit' } },
  { id: 'telegram', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'telegram-video-size-limit', cs: 'telegram-video-size-limit', es: 'telegram-video-size-limit', pt: 'telegram-video-size-limit', de: 'telegram-video-size-limit', tr: 'telegram-video-size-limit', zh: 'telegram-video-size-limit' } },
  { id: 'messenger', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'messenger-video-size-limit', cs: 'messenger-video-size-limit', es: 'messenger-video-size-limit', pt: 'messenger-video-size-limit', de: 'messenger-video-size-limit', tr: 'messenger-video-size-limit', zh: 'messenger-video-size-limit' } },
  { id: 'signal', category: 'reference', template: 'platform', sharedContent: ['limits'], locales: ['en'], slugs: { en: 'signal-video-size-limit', cs: 'signal-video-size-limit', es: 'signal-video-size-limit', pt: 'signal-video-size-limit', de: 'signal-video-size-limit', tr: 'signal-video-size-limit', zh: 'signal-video-size-limit' } },
  { id: 'calc', category: 'reference', template: 'calculator', locales: ['en', 'cs', 'es', 'pt', 'de', 'tr', 'zh'], slugs: { en: 'video-bitrate-calculator', cs: 'kalkulacka-datoveho-toku', es: 'calculadora-de-bitrate-de-video', pt: 'calculadora-de-bitrate-de-video', de: 'video-bitrate-rechner', tr: 'video-bitrate-hesaplayici', zh: 'shipin-matelv-jisuanqi' } },
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
