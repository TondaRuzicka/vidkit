import type { TrimRange } from '../core/types';
import { formatClock, h } from './dom';
import { t } from './i18n';

export interface TrimControls {
  el: HTMLElement;
  /** Load the picked file into the preview and reset the range to "all of it". */
  setFile(file: File | null): void;
  /** The chosen range, or null when the whole file is kept (or unknown). */
  getRange(): TrimRange | null;
  setDisabled(disabled: boolean): void;
}

/** Shortest cut worth encoding; also the gap the two handles keep. */
const MIN_KEEP_S = 0.5;
const STEP_S = 0.1;

/**
 * Start/end sliders over a muted preview of the file. Two labelled sliders
 * rather than one two-handled track: native keyboard semantics for free, no
 * pointer-capture code, and the readout underneath says what will be kept.
 * Dragging a handle seeks the preview to that point so the user sees the cut.
 *
 * The duration comes from the browser's own decoder (<video>), never from a
 * probe request — nothing leaves the device. Formats the browser can't play
 * (AVI, WMV …) get a note instead of the sliders.
 */
export function createTrimControls(): TrimControls {
  const preview = h('video', {
    class: 'trim-preview',
    muted: true,
    playsinline: true,
    preload: 'metadata',
    'aria-hidden': 'true',
    hidden: true,
  }) as HTMLVideoElement;

  const slider = (name: string, label: string) => {
    const input = h('input', {
      type: 'range',
      name,
      min: '0',
      max: '0',
      step: String(STEP_S),
      value: '0',
      disabled: true,
      'aria-label': label,
    }) as HTMLInputElement;
    const value = h('output', { class: 'trim-value' }, '0:00');
    const row = h(
      'label',
      { class: 'trim-row' },
      h('span', { class: 'trim-label' }, label),
      input,
      value,
    );
    return { input, value, row };
  };
  const start = slider('trim-start', t('trim.start'));
  const end = slider('trim-end', t('trim.end'));
  const keep = h('p', { class: 'trim-keep control-hint' });
  const unavailable = h('p', { class: 'trim-unavailable control-hint', hidden: true }, t('trim.unavailable'));

  const el = h(
    'fieldset',
    { class: 'control-group trim-controls' },
    h('legend', {}, t('trim.legend')),
    preview,
    start.row,
    end.row,
    keep,
    unavailable,
  );

  let durationS = 0;
  let url: string | null = null;

  const fmt = (s: number) => formatClock(s, true);

  function render(): void {
    const s = Number(start.input.value);
    const e = Number(end.input.value);
    start.value.textContent = fmt(s);
    end.value.textContent = fmt(e);
    keep.textContent = durationS
      ? t('trim.keep', { len: fmt(e - s), total: fmt(durationS) })
      : '';
  }

  function seek(toS: number): void {
    if (Number.isFinite(preview.duration)) {
      try {
        preview.currentTime = Math.min(toS, Math.max(0, preview.duration - 0.05));
      } catch {
        /* not seekable yet — harmless */
      }
    }
  }

  start.input.addEventListener('input', () => {
    const maxStart = Number(end.input.value) - MIN_KEEP_S;
    if (Number(start.input.value) > maxStart) start.input.value = String(Math.max(0, maxStart));
    seek(Number(start.input.value));
    render();
  });
  end.input.addEventListener('input', () => {
    const minEnd = Number(start.input.value) + MIN_KEEP_S;
    if (Number(end.input.value) < minEnd) end.input.value = String(Math.min(durationS, minEnd));
    seek(Number(end.input.value));
    render();
  });

  function setEnabled(on: boolean): void {
    start.input.disabled = !on;
    end.input.disabled = !on;
  }

  function reset(): void {
    durationS = 0;
    for (const i of [start.input, end.input]) {
      i.max = '0';
      i.value = '0';
    }
    setEnabled(false);
    unavailable.hidden = true;
    preview.hidden = true;
    preview.removeAttribute('src');
    if (url) URL.revokeObjectURL(url);
    url = null;
    render();
  }

  preview.addEventListener('loadedmetadata', () => {
    const d = preview.duration;
    if (!Number.isFinite(d) || d <= 0) {
      unavailable.hidden = false;
      return;
    }
    durationS = Math.round(d * 10) / 10;
    for (const i of [start.input, end.input]) i.max = String(durationS);
    start.input.value = '0';
    end.input.value = String(durationS);
    preview.hidden = false;
    setEnabled(true);
    render();
  });
  preview.addEventListener('error', () => {
    reset();
    unavailable.hidden = false;
  });

  return {
    el,
    setFile(file) {
      reset();
      if (!file) return;
      url = URL.createObjectURL(file);
      preview.src = url;
    },
    getRange() {
      if (!durationS) return null;
      const s = Number(start.input.value);
      const e = Number(end.input.value);
      // Whole file kept: no trim, so the planner and result copy stay as usual.
      if (s < STEP_S && e > durationS - STEP_S) return null;
      return { startS: s, endS: e };
    },
    setDisabled(disabled) {
      if (durationS) setEnabled(!disabled);
    },
  };
}
