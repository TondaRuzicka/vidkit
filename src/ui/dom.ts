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

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1e3)) + ' kB';
}
