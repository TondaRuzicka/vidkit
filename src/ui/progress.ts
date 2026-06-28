import type { EngineName } from '../core/types';
import { h } from './dom';
import { t } from './i18n';
import { wl, type Intent } from './labels';

export interface Progress {
  el: HTMLElement;
  setEngine(engine: EngineName): void;
  setStage(stage: 'probe' | 'encode' | 'retry'): void;
  update(framesDone: number, framesTotal: number, etaMs: number | null): void;
  reset(): void;
  onCancel: () => void;
}

function formatEta(etaMs: number): string {
  const totalS = Math.round(etaMs / 1000);
  if (totalS >= 60) {
    return t('time.minutes', { m: Math.floor(totalS / 60), s: totalS % 60 });
  }
  return t('time.seconds', { s: Math.max(1, totalS) });
}

export function createProgress(intent: Intent): Progress {
  const bar = h('div', { class: 'progress-bar-fill' });
  const barTrack = h(
    'div',
    {
      class: 'progress-bar',
      role: 'progressbar',
      'aria-label': t('progress.label'),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '0',
    },
    bar,
  );
  // Stage changes are announced; per-frame counts are visible but not live
  // (4 updates/second would spam screen readers).
  const stageText = h('p', { class: 'progress-stage', 'aria-live': 'polite' }, wl(intent, 'probing'));
  const pct = h('span', { class: 'progress__pct' }, '0%');
  const frames = h('p', { class: 'progress-frames' });
  const eta = h('p', { class: 'progress-eta' });
  const engineLine = h('p', { class: 'progress-engine' });
  const cancelBtn = h('button', { type: 'button', class: 'button-secondary' }, t('controls.cancel'));

  const el = h(
    'div',
    { class: 'progress', hidden: true },
    h('div', { class: 'progress__head' }, stageText, pct),
    barTrack,
    h('div', { class: 'progress-meta' }, frames, eta),
    engineLine,
    cancelBtn,
  );

  const api: Progress = {
    el,
    setEngine(engine) {
      engineLine.textContent = t(`status.engine.${engine}`);
    },
    setStage(stage) {
      stageText.textContent =
        stage === 'probe'
          ? wl(intent, 'probing')
          : stage === 'retry'
            ? t('progress.stage.retry')
            : wl(intent, 'stage');
    },
    update(framesDone, framesTotal, etaMs) {
      const p = framesTotal > 0 ? Math.min(100, Math.round((100 * framesDone) / framesTotal)) : 0;
      bar.style.width = p + '%';
      pct.textContent = p + '%';
      barTrack.setAttribute('aria-valuenow', String(p));
      frames.textContent = t('progress.frames', { done: framesDone, total: framesTotal });
      eta.textContent =
        etaMs === null ? t('progress.eta.calculating') : t('progress.eta', { time: formatEta(etaMs) });
    },
    reset() {
      bar.style.width = '0%';
      pct.textContent = '0%';
      barTrack.setAttribute('aria-valuenow', '0');
      frames.textContent = '';
      eta.textContent = '';
      engineLine.textContent = '';
      stageText.textContent = wl(intent, 'probing');
    },
    onCancel: () => {},
  };

  cancelBtn.addEventListener('click', () => api.onCancel());
  return api;
}
