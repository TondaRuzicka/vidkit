import en from '../locales/en.json';
import cs from '../locales/cs.json';

type StringKey = keyof typeof en;

// All locale dictionaries ship in the same widget bundle (a handful of KB
// each) and are selected at runtime by the page's <html lang>. Every locale
// must define the same keys as en.json — the `Record<StringKey, string>`
// annotation makes a missing key a build-time type error.
const DICTS: Record<string, Record<StringKey, string>> = { en, cs };

function activeStrings(): Record<StringKey, string> {
  const lang =
    typeof document !== 'undefined' ? document.documentElement.lang : 'en';
  return DICTS[lang] ?? en;
}

export function t(
  key: StringKey,
  params?: Record<string, string | number>,
): string {
  let s: string = activeStrings()[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      s = s.replaceAll(`{${name}}`, String(value));
    }
  }
  return s;
}
