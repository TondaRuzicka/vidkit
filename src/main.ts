import './styles/widget.css';
import type { UiToWorker, WorkerToUi } from './core/types';

// SPIKE harness: minimal functional UI to validate the worker pipeline.
// Replaced by the real widget (src/ui/) in a later phase.
const mount = document.getElementById('compressor');

function spikeHarness(root: HTMLElement) {
  root.innerHTML = `
    <input type="file" accept="video/*" id="spike-file" />
    <button id="spike-start" disabled>Compress (spike)</button>
    <button id="spike-cancel" disabled>Cancel</button>
    <p id="spike-status" aria-live="polite"></p>
    <p id="spike-result"></p>
  `;
  const fileInput = root.querySelector<HTMLInputElement>('#spike-file')!;
  const startBtn = root.querySelector<HTMLButtonElement>('#spike-start')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('#spike-cancel')!;
  const status = root.querySelector<HTMLParagraphElement>('#spike-status')!;
  const result = root.querySelector<HTMLParagraphElement>('#spike-result')!;

  let worker: Worker | null = null;

  const finish = () => {
    startBtn.disabled = !fileInput.files?.length;
    cancelBtn.disabled = true;
    worker = null;
  };

  fileInput.onchange = () => {
    startBtn.disabled = !fileInput.files?.length;
  };

  startBtn.onclick = () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    worker = new Worker(
      new URL('./workers/compress.worker.ts', import.meta.url),
      { type: 'module' },
    );
    startBtn.disabled = true;
    cancelBtn.disabled = false;
    result.textContent = '';
    const t0 = performance.now();

    worker.onmessage = (e: MessageEvent<WorkerToUi>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'probe':
          status.textContent = `probed: ${msg.meta.container} ${msg.meta.video.codec} ${msg.meta.video.width}x${msg.meta.video.height} ${msg.meta.durationS.toFixed(1)}s`;
          break;
        case 'engine':
          console.log('[spike] engine:', msg.engine);
          break;
        case 'progress':
          status.textContent = `${msg.framesDone}/${msg.framesTotal} frames, eta ${msg.etaMs === null ? '…' : Math.round(msg.etaMs / 1000) + 's'}`;
          break;
        case 'done': {
          const secs = ((performance.now() - t0) / 1000).toFixed(1);
          status.textContent = `done in ${secs}s`;
          const url = URL.createObjectURL(msg.blob);
          result.innerHTML = '';
          const a = document.createElement('a');
          a.href = url;
          a.download = 'compressed.mp4';
          a.textContent = `download (${(msg.stats.outBytes / 1e6).toFixed(2)} MB, was ${(msg.stats.inBytes / 1e6).toFixed(2)} MB)`;
          result.append(a);
          finish();
          break;
        }
        case 'error':
          status.textContent = `error: ${msg.code} ${msg.detail ?? ''}`;
          finish();
          break;
      }
    };

    worker.postMessage({
      type: 'start',
      file,
      options: { mode: 'target', targetMB: 25 },
    } satisfies UiToWorker);
  };

  cancelBtn.onclick = () => {
    worker?.postMessage({ type: 'cancel' } satisfies UiToWorker);
    // Hard backstop: reclaim the worker heap even if cleanup hangs.
    const w = worker;
    setTimeout(() => w?.terminate(), 2000);
  };
}

if (mount) spikeHarness(mount);
