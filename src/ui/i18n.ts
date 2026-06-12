import strings from '../locales/en.json';

type StringKey = keyof typeof strings;

// Build-time import keeps this synchronous and bundle-only. When locales are
// added, swap the import for a lookup keyed off the URL prefix — call sites
// stay unchanged.
export function t(
  key: StringKey,
  params?: Record<string, string | number>,
): string {
  let s: string = strings[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      s = s.replaceAll(`{${name}}`, String(value));
    }
  }
  return s;
}
