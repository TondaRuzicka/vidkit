/// <reference lib="webworker" />
import { compress, type SelectedEngine } from '../core/compress';
import { CompressError, type ProbeResult, type UiToWorker, type WorkerToUi } from '../core/types';
import { webcodecsEngine } from '../engines/webcodecs';

const post = (msg: WorkerToUi) =>
  (self as DedicatedWorkerGlobalScope).postMessage(msg);

const abort = new AbortController();
let started = false;

// Engine selection matrix lands in a later phase; WebCodecs only for now.
async function selectEngine(_meta: ProbeResult): Promise<SelectedEngine> {
  return { name: 'webcodecs', engine: webcodecsEngine };
}

self.onmessage = async (event: MessageEvent<UiToWorker>) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    abort.abort();
    return;
  }
  if (msg.type !== 'start' || started) return;
  started = true;

  const t0 = performance.now();
  let frameCount = 1;
  let etaMs: number | null = null;
  let lastPost = 0;

  try {
    const { blob, stats } = await compress(
      msg.file,
      msg.options,
      selectEngine,
      {
        onProbe: (meta) => {
          frameCount = meta.video.frameCount;
          post({ type: 'probe', meta });
        },
        onEngine: (engine) => post({ type: 'engine', engine }),
        onProgress: (fraction, stage, attempt) => {
          const now = performance.now();
          if (now - lastPost < 250 && fraction < 1) return; // ≤4 posts/s
          lastPost = now;
          // ETA from throughput once 10% in; retries restart the projection.
          if (fraction >= 0.1) {
            const elapsed = now - t0;
            const raw = (elapsed * (1 - fraction)) / fraction;
            etaMs = etaMs === null ? raw : 0.7 * etaMs + 0.3 * raw;
          }
          post({
            type: 'progress',
            framesDone: Math.round(fraction * frameCount),
            framesTotal: frameCount,
            etaMs: attempt > 1 ? null : etaMs,
            stage,
          });
        },
      },
      abort.signal,
    );
    post({ type: 'done', blob, stats });
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
