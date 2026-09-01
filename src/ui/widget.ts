import type { FormatId } from '../core/formats';
import type {
  CompressOptions,
  EngineName,
  ErrorCode,
  TrimRange,
  UiToWorker,
  WorkerToUi,
} from '../core/types';
import { createControls } from './controls';
import { formatClock, h, icon } from './dom';
import { createDropzone } from './dropzone';
import { t } from './i18n';
import { intentOf, wl } from './labels';
import { createProgress } from './progress';
import { createResult } from './result';
import { track } from './track';
import { createTrimControls } from './trim';

export interface WidgetConfig {
  /** 'trim' = the trim tool: range controls shown, quality mode first. */
  tool: 'compress' | 'trim';
  /** Compress pages can offer trimming behind a collapsed row. */
  trimOptional: boolean;
  lockedTargetMB: number | null;
  defaultTargetMB: number;
  lockedFormat: FormatId | null;
  defaultFormat: FormatId;
  formatChoices: readonly FormatId[] | null;
}

type State = 'idle' | 'ready' | 'working' | 'done' | 'error';

const ERROR_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 8.5v4.5M12 16.5v.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

const ENGINE_SHORT: Record<EngineName, string> = {
  webcodecs: 'WebCodecs',
  ffmpeg: 'FFmpeg',
};

export function mountWidget(root: HTMLElement, config: WidgetConfig): void {
  const intent = intentOf(config.lockedFormat, config.tool);
  const dropzone = createDropzone(intent);
  const controls = createControls({
    ...config,
    defaultMode: config.tool === 'trim' ? 'quality' : 'target',
  });
  // Range controls: always on the trim tool, behind a <details> when optional.
  const trim = config.tool === 'trim' || config.trimOptional ? createTrimControls() : null;
  const trimBlock =
    trim && config.trimOptional && config.tool !== 'trim'
      ? h('details', { class: 'trim-optional' }, h('summary', {}, t('trim.optional')), trim.el)
      : trim?.el ?? null;
  // Sliders at 0:00–0:00 mean nothing before a file is picked; show the block
  // once there is a duration to slide over.
  if (trimBlock) trimBlock.hidden = true;
  const progress = createProgress(intent);
  const result = createResult(intent);

  // Header chip — decorative status, distinct from the .progress-engine line
  // the e2e suite reads.
  const engineStatus = h('span', {}, t('widget.status.ready'));
  const head = h(
    'div',
    { class: 'compressor__head' },
    h('span', { class: 'compressor__title' }, wl(intent, 'title')),
    h('span', { class: 'compressor__engine' }, h('span', { class: 'dot' }), engineStatus),
  );

  const startBtn = h(
    'button',
    { type: 'button', class: 'button-primary', disabled: true },
    wl(intent, 'start'),
  );
  const notice = h('p', { class: 'widget-notice', hidden: true });

  const errorText = h('p', {});
  const retryBtn = h('button', { type: 'button', class: 'button-secondary' }, t('error.tryAgain'));
  // One-click recovery for targetTooSmall: pre-set the smallest feasible
  // target and restart. Hidden unless the worker sent a suggestion.
  const suggestBtn = h('button', { type: 'button', class: 'button-primary', hidden: true });
  // The other recovery: keep the target, compress only the opening stretch
  // that fits. Offered on locked pages too — there the target is the page's
  // promise, so this is the only way out that keeps it.
  const trimBtn = h('button', { type: 'button', class: 'button-primary', hidden: true });
  const errorBox = h(
    'div',
    { class: 'widget-error error-state', role: 'alert', hidden: true },
    h('span', { class: 'error-state__icon' }, icon(ERROR_ICON)),
    h('h3', {}, t('error.heading')),
    errorText,
    h('div', { class: 'error-actions' }, suggestBtn, trimBtn, retryBtn),
  );

  const setupSection = h(
    'div',
    { class: 'widget-setup' },
    dropzone.el,
    trimBlock,
    controls.el,
    notice,
    h('div', { class: 'control-foot' }, startBtn),
  );
  const body = h('div', { class: 'compressor__body' }, setupSection, progress.el, result.el, errorBox);
  root.append(head, body);

  let state: State = 'idle';
  let file: File | null = null;
  let worker: Worker | null = null;
  // Set by the trim recovery for the next run only; cleared once consumed.
  let pendingTrim: TrimRange | null = null;

  function setEngineStatus(text: string): void {
    engineStatus.textContent = text;
  }

  function setState(next: State): void {
    state = next;
    setupSection.hidden = next === 'working' || next === 'done';
    progress.el.hidden = next !== 'working';
    if (next !== 'done') result.el.hidden = true;
    errorBox.hidden = next !== 'error';
    startBtn.disabled = next !== 'ready';
    controls.setDisabled(next === 'working');
    trim?.setDisabled(next === 'working');
    if (next === 'idle' || next === 'ready') setEngineStatus(t('widget.status.ready'));
  }

  function updateNotice(): void {
    const options = controls.getOptions();
    if (
      file &&
      options.mode === 'target' &&
      file.size <= options.targetMB * 1_000_000
    ) {
      notice.hidden = false;
      notice.textContent = t('controls.alreadyUnder', { mb: options.targetMB });
    } else {
      notice.hidden = true;
    }
  }

  function cleanupWorker(): void {
    worker?.terminate();
    worker = null;
  }

  dropzone.onFile = (picked) => {
    file = picked;
    dropzone.setFile(picked);
    trim?.setFile(picked);
    if (trimBlock) trimBlock.hidden = false;
    updateNotice();
    setState('ready');
    track('compressor_file_selected'); // earliest "tried to use it" signal
  };
  // 'input' as well as 'change': if the notice only updated on change (i.e.
  // on blur), clicking Compress right after typing a custom target would
  // hide the notice mid-click — the button shifts up under the pointer and
  // the user's click lands on nothing.
  controls.el.addEventListener('change', updateNotice);
  controls.el.addEventListener('input', updateNotice);

  startBtn.addEventListener('click', () => {
    if (!file || state === 'working') return;
    // A recovery trim (keep the target, cut the video) wins over the range
    // controls; otherwise a user-chosen range applies when it isn't the whole file.
    const userTrim = trim?.getRange() ?? null;
    const range: TrimRange | null = pendingTrim ?? userTrim;
    const trimSource: 'recovery' | 'range' | null = pendingTrim ? 'recovery' : userTrim ? 'range' : null;
    const options: CompressOptions = range
      ? { ...controls.getOptions(), trim: range }
      : controls.getOptions();
    pendingTrim = null;
    setState('working');
    progress.reset();
    // Tool choices only — no file data. Counts how many actually start a job.
    track('compressor_started', {
      format: options.format ?? 'mp4',
      mode: options.mode,
      trimmed: trimSource !== null,
    });
    let frameTotal = 0;

    worker = new Worker(new URL('../workers/compress.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerToUi>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'probe':
          frameTotal =
            msg.meta.video?.frameCount ?? Math.max(1, Math.round(msg.meta.durationS * 30));
          progress.update(0, frameTotal, null);
          break;
        case 'engine':
          progress.setEngine(msg.engine);
          setEngineStatus(ENGINE_SHORT[msg.engine]);
          break;
        case 'progress':
          progress.setStage(msg.stage);
          progress.update(msg.framesDone, msg.framesTotal, msg.etaMs);
          break;
        case 'done':
          cleanupWorker();
          setState('done');
          result.show(file!, msg.blob, msg.stats);
          result.setNote(
            msg.stats.trimmedS === undefined
              ? null
              : trimSource === 'recovery' && options.mode === 'target'
                ? t('result.trimmed', { time: formatClock(msg.stats.trimmedS), mb: options.targetMB })
                : t('result.trimmedRange', {
                    start: formatClock(range!.startS, true),
                    end: formatClock(range!.endS, true),
                    len: formatClock(msg.stats.trimmedS, true),
                  }),
          );
          track('compressor_completed', { format: msg.stats.format, engine: msg.stats.engine });
          break;
        case 'error':
          cleanupWorker();
          showError(msg.code, msg.suggestedTargetMB, msg.suggestedTrimS);
          track('compressor_failed', { code: msg.code });
          break;
      }
    };
    worker.onerror = () => {
      cleanupWorker();
      showError('unknown');
    };
    worker.postMessage({
      type: 'start',
      file,
      options,
    } satisfies UiToWorker);
  });

  progress.onCancel = () => {
    worker?.postMessage({ type: 'cancel' } satisfies UiToWorker);
    // Backstop: terminate reclaims all memory even if cleanup hangs.
    const w = worker;
    setTimeout(() => {
      if (worker === w) {
        cleanupWorker();
        if (state === 'working') showError('cancelled');
      }
    }, 2000);
  };

  let suggestedMB: number | null = null;
  let suggestedTrimS: number | null = null;

  function showError(code: ErrorCode, suggestMB?: number, trimS?: number): void {
    suggestedMB = suggestMB ?? null;
    suggestedTrimS = trimS ?? null;
    // Locked pages keep their promised target — show the explanation but not
    // the switch-target action.
    const canApply = suggestedMB !== null && config.lockedTargetMB === null;
    const current = controls.getOptions();
    const targetMB =
      config.lockedTargetMB ?? (current.mode === 'target' ? current.targetMB : 0);
    const parts = [
      suggestedMB !== null
        ? t('error.targetTooSmall.suggest', { mb: suggestedMB })
        : t(`error.${code}`),
    ];
    if (suggestedTrimS !== null) {
      parts.push(t('error.targetTooSmall.trim', { mb: targetMB, time: formatClock(suggestedTrimS) }));
    }
    errorText.textContent = parts.join(' ');
    suggestBtn.hidden = !canApply;
    if (canApply) suggestBtn.textContent = t('error.useSuggested', { mb: suggestedMB! });
    trimBtn.hidden = suggestedTrimS === null;
    if (suggestedTrimS !== null) {
      trimBtn.textContent = t('error.useTrim', { time: formatClock(suggestedTrimS) });
    }
    setState('error');
  }

  trimBtn.addEventListener('click', () => {
    if (suggestedTrimS === null || !file) return;
    pendingTrim = { startS: 0, endS: suggestedTrimS };
    setState('ready');
    // Tool choice only — the kept length is file metadata and never leaves.
    track('compressor_trim_used');
    startBtn.click();
  });

  suggestBtn.addEventListener('click', () => {
    if (suggestedMB === null || !file) return;
    controls.setTargetMB(suggestedMB);
    updateNotice();
    setState('ready');
    track('compressor_suggestion_used');
    startBtn.click();
  });

  retryBtn.addEventListener('click', () => {
    setState(file ? 'ready' : 'idle');
  });

  result.onAgain = () => {
    result.reset();
    file = null;
    dropzone.setFile(null);
    trim?.setFile(null);
    if (trimBlock) trimBlock.hidden = true;
    updateNotice();
    setState('idle');
  };

  setState('idle');
}
