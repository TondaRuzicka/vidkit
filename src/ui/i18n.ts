import en from '../locales/en.json';
import cs from '../locales/cs.json';
import es from '../locales/es.json';
import pt from '../locales/pt.json';
import de from '../locales/de.json';
import tr from '../locales/tr.json';
import zh from '../locales/zh.json';

type StringKey = keyof typeof en;

// All locale dictionaries ship in the same widget bundle (a handful of KB
// each) and are selected at runtime by the page's <html lang>. Every locale
// must define the same keys as en.json — the `Record<StringKey, string>`
// annotation makes a missing key a build-time type error.
const DICTS: Record<string, Record<StringKey, string>> = { en, cs, es, pt, de, tr, zh };

function activeStrings(): Record<StringKey, string> {
  const lang =
    typeof document !== 'undefined' ? document.documentElement.lang : 'en';
  // Only the primary subtag selects a dictionary: <html lang> can carry a
  // script or region ('zh-Hans'), which hreflang needs but the widget doesn't.
  return DICTS[lang.split('-')[0]!.toLowerCase()] ?? en;
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
