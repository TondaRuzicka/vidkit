// Language suggestion banner — Google's recommended pattern: suggest, never
// auto-redirect (a hard geo/redirect can stop Googlebot from crawling the other
// locale and reads as cloaking). Pure client-side, so the site stays static and
// search engines still see the normal page. The target URL comes from the
// hreflang alternates already in <head>, so there are no hardcoded mappings.
// The choice is remembered in localStorage — a functional preference, exempt
// from EU cookie consent.

const SUPPORTED = ['en', 'cs'] as const;
type Locale = (typeof SUPPORTED)[number];
const isLocale = (s: string): s is Locale =>
  (SUPPORTED as readonly string[]).includes(s);

const STORE_KEY = 'vk-lang';

// Copy is written in the language being offered, so the reader understands it.
const COPY: Record<Locale, { msg: string; action: string; dismiss: string }> = {
  cs: {
    msg: 'Tato stránka je k dispozici i v češtině.',
    action: 'Přepnout na češtinu',
    dismiss: 'Zavřít',
  },
  en: {
    msg: 'This page is also available in English.',
    action: 'Switch to English',
    dismiss: 'Dismiss',
  },
};

function base(tag: string): string {
  return tag.slice(0, 2).toLowerCase();
}

function preferredLocale(): Locale | null {
  const langs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const l of langs) {
    if (l && isLocale(base(l))) return base(l) as Locale;
  }
  return null;
}

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode / storage disabled — banner just won't be remembered */
  }
};

function init(): void {
  const current = base(document.documentElement.lang || 'en');
  if (!isLocale(current)) return;

  // Once the visitor has switched or dismissed, never nag again.
  if (read(STORE_KEY)) return;

  const preferred = preferredLocale();
  if (!preferred || preferred === current) return;

  const alt = document.querySelector<HTMLLinkElement>(
    `link[rel="alternate"][hreflang="${preferred}"]`,
  );
  if (!alt?.href) return;
  // Same-origin path, so it works identically on localhost and in production.
  const targetPath = new URL(alt.href).pathname;

  const copy = COPY[preferred];
  const banner = document.createElement('div');
  banner.className = 'lang-banner';
  banner.lang = preferred;
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', copy.action);

  const text = document.createElement('span');
  text.className = 'lang-banner__text';
  text.textContent = copy.msg;

  const link = document.createElement('a');
  link.className = 'lang-banner__switch';
  link.setAttribute('href', targetPath);
  link.textContent = copy.action;
  link.addEventListener('click', () => write(STORE_KEY, preferred));

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lang-banner__close';
  close.setAttribute('aria-label', copy.dismiss);
  close.textContent = '✕';
  close.addEventListener('click', () => {
    write(STORE_KEY, current); // they want to stay in the current language
    banner.remove();
  });

  banner.append(text, link, close);
  document.body.prepend(banner);
}

init();
