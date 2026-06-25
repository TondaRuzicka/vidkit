import { FORMATS } from '../core/formats';
import type { ResultStats } from '../core/types';
import { formatBytes, h, icon } from './dom';
import { t } from './i18n';

export interface ResultView {
  el: HTMLElement;
  show(originalFile: File, blob: Blob, stats: ResultStats): void;
  /** Revoke object URLs and stop playback. */
  reset(): void;
  onAgain: () => void;
}

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const DOWN_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v13M6 12l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const HANDLE_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M9.5 7L5 12l4.5 5M14.5 7l4.5 5-4.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function createResult(): ResultView {
  const heading = h('h3', { class: 'result-heading', tabindex: '-1' }, t('result.heading'));
  const banner = h(
    'div',
    { class: 'result__banner' },
    h('span', { class: 'check' }, icon(CHECK_ICON)),
    heading,
  );

  // Canonical, machine-readable summary (also the screen-reader text). The
  // e2e suite asserts on this string, so it stays even though the size boxes
  // below present the same numbers visually.
  const sizes = h('p', { class: 'result-sizes visually-hidden' });

  const beforeVal = h('span', { class: 'v' });
  const afterVal = h('span', { class: 'v' });
  const savedVal = h('span', {});
  const sizeCompare = h(
    'div',
    { class: 'size-compare' },
    h('div', { class: 'size-box before' }, h('span', { class: 'k' }, t('result.original')), beforeVal),
    h('div', { class: 'size-arrow' }, icon(DOWN_ICON), savedVal),
    h('div', { class: 'size-box after' }, h('span', { class: 'k' }, t('result.compressed')), afterVal),
  );

  const dims = h('p', { class: 'result-dims' });

  const videoOriginal = h('video', { muted: true, playsinline: true, loop: true, 'aria-label': t('result.original') });
  const videoCompressed = h('video', { muted: true, playsinline: true, loop: true, 'aria-label': t('result.compressed') });
  const slider = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    value: '50',
    class: 'compare-slider',
    'aria-label': t('result.compare'),
  });
  const compareWrap = h(
    'div',
    { class: 'compare' },
    h('div', { class: 'compare-pane' }, videoOriginal, h('span', { class: 'compare-tag compare-tag-left' }, t('result.original'))),
    h('div', { class: 'compare-pane compare-pane-top' }, videoCompressed, h('span', { class: 'compare-tag compare-tag-right' }, t('result.compressed'))),
    h('div', { class: 'compare__divider' }),
    h('div', { class: 'compare__handle' }, icon(HANDLE_ICON)),
    slider,
  );
  const compareHint = h('p', { class: 'compare-hint' }, t('result.compare.hint'));

  const downloadLink = h('a', { class: 'button-primary result-download' }, t('result.download'));
  const playBtn = h('button', { type: 'button', class: 'button-secondary' }, t('result.play'));
  const againBtn = h('button', { type: 'button', class: 'button-secondary' }, t('result.again'));

  const el = h(
    'div',
    { class: 'result', hidden: true },
    banner,
    sizes,
    sizeCompare,
    compareWrap,
    dims,
    compareHint,
    h('div', { class: 'result-actions' }, downloadLink, playBtn, againBtn),
  );

  let urls: string[] = [];
  let playing = false;

  const applyClip = () => {
    // --pos drives the top pane's clip, the divider and the handle together.
    compareWrap.style.setProperty('--pos', `${Number(slider.value)}%`);
  };
  slider.addEventListener('input', applyClip);

  const setPlaying = (on: boolean) => {
    playing = on;
    playBtn.textContent = on ? t('result.pause') : t('result.play');
    for (const v of [videoOriginal, videoCompressed]) {
      if (on) void v.play().catch(() => {});
      else v.pause();
    }
  };
  playBtn.addEventListener('click', () => setPlaying(!playing));

  const api: ResultView = {
    el,
    show(originalFile, blob, stats) {
      api.reset();
      const urlOriginal = URL.createObjectURL(originalFile);
      const urlCompressed = URL.createObjectURL(blob);
      urls = [urlOriginal, urlCompressed];
      videoOriginal.src = urlOriginal;
      videoCompressed.src = urlCompressed;
      slider.value = '50';
      applyClip();

      const saved = Math.max(0, Math.round(100 * (1 - stats.outBytes / stats.inBytes)));
      sizes.textContent = t('result.sizes', {
        original: formatBytes(stats.inBytes),
        compressed: formatBytes(stats.outBytes),
        saved,
      });
      beforeVal.textContent = formatBytes(stats.inBytes);
      afterVal.textContent = formatBytes(stats.outBytes);
      savedVal.textContent = `−${saved}%`;
      dims.textContent = t('result.dimensions', {
        width: stats.width,
        height: stats.height,
        fps: Math.round(stats.fps),
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const ext = FORMATS[stats.format].ext;
      downloadLink.textContent = t('result.download', { format: ext.toUpperCase() });
      (downloadLink as HTMLAnchorElement).href = urlCompressed;
      (downloadLink as HTMLAnchorElement).download =
        originalFile.name.replace(/\.\w+$/, '') + `-vidkit-${stamp}.${ext}`;
      el.hidden = false;
      heading.focus();
    },
    reset() {
      setPlaying(false);
      videoOriginal.removeAttribute('src');
      videoCompressed.removeAttribute('src');
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
      el.hidden = true;
    },
    onAgain: () => {},
  };

  againBtn.addEventListener('click', () => api.onAgain());
  return api;
}
