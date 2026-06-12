/// <reference lib="webworker" />
import { probe } from '../core/probe';
import { CompressError, type UiToWorker, type WorkerToUi } from '../core/types';
import { webcodecsEngine } from '../engines/webcodecs';

const post = (msg: WorkerToUi, transfer?: Transferable[]) =>
  (self as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? []);

const abort = new AbortController();
let started = false;

self.onmessage = async (event: MessageEvent<UiToWorker>) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    abort.abort();
    return;
  }
  if (msg.type !== 'start' || started) return;
  started = true;

  const t0 = performance.now();
  try {
    const meta = await probe(msg.file);
    post({ type: 'probe', meta });
    post({ type: 'engine', engine: 'webcodecs' });

    // SPIKE plan: source dimensions, fixed 2.5 Mbps video, audio passthrough.
    // Replaced by core/targetSize math in the next phase.
    const plan = {
      width: meta.video.width,
      height: meta.video.height,
      fps: meta.video.fps,
      videoBps: 2_500_000,
      audioBps: null,
      keyFrameIntervalS: 2,
    };

    // ETA: simple projection from throughput, EMA-smoothed to stop it jumping.
    let etaMs: number | null = null;
    const onProgress = (p: number) => {
      if (p >= 0.1) {
        const elapsed = performance.now() - t0;
        const raw = (elapsed * (1 - p)) / p;
        etaMs = etaMs === null ? raw : 0.7 * etaMs + 0.3 * raw;
      }
      post({
        type: 'progress',
        framesDone: Math.round(p * meta.video.frameCount),
        framesTotal: meta.video.frameCount,
        etaMs,
        stage: 'encode',
      });
    };

    const blob = await webcodecsEngine.run(
      msg.file,
      plan,
      { onProgress },
      abort.signal,
    );

    post({
      type: 'done',
      blob,
      stats: {
        inBytes: msg.file.size,
        outBytes: blob.size,
        width: plan.width,
        height: plan.height,
        fps: plan.fps,
        videoKbps: Math.round(plan.videoBps / 1000),
        audioKbps: null,
        engine: 'webcodecs',
        attempts: 1,
        wallMs: Math.round(performance.now() - t0),
      },
    });
  } catch (err) {
    if (err instanceof CompressError) {
      post({ type: 'error', code: err.code, detail: err.message });
    } else {
      post({ type: 'error', code: 'unknown', detail: String(err) });
    }
  } finally {
    self.close();
  }
};
