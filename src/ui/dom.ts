/** Tiny DOM builder — keeps the widget code free of innerHTML string soup. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (value === true) el.setAttribute(name, '');
    else el.setAttribute(name, value);
  }
  for (const child of children) {
    if (child !== null) el.append(child);
  }
  return el;
}

/**
 * Build an inline SVG node from markup. <template> parses SVG in its correct
 * namespace, so the result is a real SVGElement (createElement can't do this).
 * Icons are inline + decorative — callers mark them aria-hidden.
 */
export function icon(markup: string): SVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  const node = tpl.content.firstElementChild as SVGElement;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1e3)) + ' kB';
}

/**
 * Seconds → "m:ss" (or "h:mm:ss"), for durations shown to the user. With
 * `tenths`, "m:ss.t" — for trim points, where a whole second is too coarse.
 */
export function formatClock(totalS: number, tenths = false): string {
  const total = Math.max(0, tenths ? Math.round(totalS * 10) / 10 : Math.round(totalS));
  const s = Math.floor(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const frac = tenths ? '.' + Math.round((total - s) * 10) : '';
  return `${h > 0 ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}${frac}`;
}
