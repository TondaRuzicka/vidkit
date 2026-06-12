import type { ErrorCode, UiToWorker, WorkerToUi } from '../core/types';
import { createControls } from './controls';
import { h } from './dom';
import { createDropzone } from './dropzone';
import { t } from './i18n';
import { createProgress } from './progress';
import { createResult } from './result';

export interface WidgetConfig {
  lockedTargetMB: number | null;
  defaultTargetMB: number;
}

type State = 'idle' | 'ready' | 'working' | 'done' | 'error';

export function mountWidget(root: HTMLElement, config: WidgetConfig): void {
  const dropzone = createDropzone();
  const controls = createControls(config);
  const progress = createProgress();
  const result = createResult();

  const startBtn = h(
    'button',
    { type: 'button', class: 'button-primary', disabled: true },
    t('controls.start'),
  );
  const notice = h('p', { class: 'widget-notice', hidden: true });
  const errorBox = h('div', { class: 'widget-error', role: 'alert', hidden: true });
  const errorText = h('p', {});
  const retryBtn = h('button', { type: 'button', class: 'button-secondary' }, t('error.tryAgain'));
  errorBox.append(h('h3', {}, t('error.heading')), errorText, retryBtn);

  const setupSection = h('div', { class: 'widget-setup' }, dropzone.el, controls.el, notice, startBtn);
  root.append(setupSection, progress.el, result.el, errorBox);

  let state: State = 'idle';
  let file: File | null = null;
  let worker: Worker | null = null;

  function setState(next: State): void {
    state = next;
    setupSection.hidden = next === 'working' || next === 'done';
    progress.el.hidden = next !== 'working';
    if (next !== 'done') result.el.hidden = true;
    errorBox.hidden = next !== 'error';
    startBtn.disabled = next !== 'ready';
    controls.setDisabled(next === 'working');
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
    updateNotice();
    setState('ready');
  };
  // 'input' as well as 'change': if the notice only updated on change (i.e.
  // on blur), clicking Compress right after typing a custom target would
  // hide the notice mid-click — the button shifts up under the pointer and
  // the user's click lands on nothing.
  controls.el.addEventListener('change', updateNotice);
  controls.el.addEventListener('input', updateNotice);

  startBtn.addEventListener('click', () => {
    if (!file || state === 'working') return;
    setState('working');
    progress.reset();
    let frameTotal = 0;

    worker = new Worker(new URL('../workers/compress.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerToUi>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'probe':
          frameTotal = msg.meta.video.frameCount;
          progress.update(0, frameTotal, null);
          break;
        case 'engine':
          progress.setEngine(msg.engine);
          break;
        case 'progress':
          progress.setStage(msg.stage);
          progress.update(msg.framesDone, msg.framesTotal, msg.etaMs);
          break;
        case 'done':
          cleanupWorker();
          setState('done');
          result.show(file!, msg.blob, msg.stats);
          break;
        case 'error':
          cleanupWorker();
          showError(msg.code);
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
      options: controls.getOptions(),
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

  function showError(code: ErrorCode): void {
    errorText.textContent = t(`error.${code}`);
    setState('error');
  }

  retryBtn.addEventListener('click', () => {
    setState(file ? 'ready' : 'idle');
  });

  result.onAgain = () => {
    result.reset();
    file = null;
    dropzone.setFile(null);
    updateNotice();
    setState('idle');
  };

  setState('idle');
}
