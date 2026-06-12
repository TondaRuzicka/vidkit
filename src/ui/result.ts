import type { ResultStats } from '../core/types';
import { formatBytes, h } from './dom';
import { t } from './i18n';

export interface ResultView {
  el: HTMLElement;
  show(originalFile: File, blob: Blob, stats: ResultStats): void;
  /** Revoke object URLs and stop playback. */
  reset(): void;
  onAgain: () => void;
}

export function createResult(): ResultView {
  const heading = h('h3', { class: 'result-heading', tabindex: '-1' }, t('result.heading'));
  const sizes = h('p', { class: 'result-sizes' });
  const dims = h('p', { class: 'result-dims' });

  const videoOriginal = h('video', { muted: true, playsinline: true, loop: true, 'aria-label': t('result.original') });
  const videoCompressed = h('video', { muted: true, playsinline: true, loop: true, 'aria-label': t('result.compressed') });
  const compareWrap = h(
    'div',
    { class: 'compare' },
    h('div', { class: 'compare-pane' }, videoOriginal, h('span', { class: 'compare-tag compare-tag-left' }, t('result.original'))),
    h('div', { class: 'compare-pane compare-pane-top' }, videoCompressed, h('span', { class: 'compare-tag compare-tag-right' }, t('result.compressed'))),
  );
  const slider = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    value: '50',
    class: 'compare-slider',
    'aria-label': t('result.compare'),
  });
  const playBtn = h('button', { type: 'button', class: 'button-secondary' }, t('result.play'));
  const compareHint = h('p', { class: 'compare-hint' }, t('result.compare.hint'));

  const downloadLink = h('a', { class: 'button-primary result-download' }, t('result.download'));
  const againBtn = h('button', { type: 'button', class: 'button-secondary' }, t('result.again'));

  const el = h(
    'div',
    { class: 'result', hidden: true },
    heading,
    sizes,
    dims,
    compareWrap,
    h('div', { class: 'compare-controls' }, slider, playBtn),
    compareHint,
    h('div', { class: 'result-actions' }, downloadLink, againBtn),
  );

  let urls: string[] = [];
  let playing = false;

  const applyClip = () => {
    // Top pane shows the compressed video to the RIGHT of the divider.
    const pct = Number(slider.value);
    (compareWrap.querySelector('.compare-pane-top') as HTMLElement).style.clipPath =
      `inset(0 0 0 ${pct}%)`;
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
      dims.textContent = t('result.dimensions', {
        width: stats.width,
        height: stats.height,
        fps: Math.round(stats.fps),
      });
      const stamp = new Date().toISOString().slice(0, 10);
      (downloadLink as HTMLAnchorElement).href = urlCompressed;
      (downloadLink as HTMLAnchorElement).download =
        originalFile.name.replace(/\.\w+$/, '') + `-compressed-${stamp}.mp4`;
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
