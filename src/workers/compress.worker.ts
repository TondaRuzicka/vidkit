/// <reference lib="webworker" />
import { compress } from '../core/compress.ts';
import { minFeasibleTargetMB, WEBCODECS_MIN_AUDIO_BPS } from '../core/targetSize.ts';
import {
  CompressError,
  type ProbeResult,
  type UiToWorker,
  type WorkerToUi,
} from '../core/types.ts';
import { FFMPEG_MAX_INPUT_BYTES, FFMPEG_MIN_AUDIO_BPS } from '../engines/ffmpeg.ts';

const post = (msg: WorkerToUi) =>
  (self as DedicatedWorkerGlobalScope).postMessage(msg);

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
  let frameCount = 1;
  let etaMs: number | null = null;
  let lastPost = 0;
  let probed: ProbeResult | null = null;

  try {
    const { blob, stats } = await compress(
      msg.file,
      msg.options,
      {
        onProbe: (meta) => {
          probed = meta;
          // Audio-only inputs have no video frames — fall back to a
          // duration-based denominator so the progress fraction still maps.
          frameCount =
            meta.video?.frameCount ?? Math.max(1, Math.round(meta.durationS * 30));
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
      // An infeasible target is the most common real-world failure. Compute
      // the smallest target this exact video CAN hit (using the most
      // permissive engine that could take the file) so the UI can offer it.
      let suggestedTargetMB: number | undefined;
      // TS can't see the onProbe-closure assignment, so widen explicitly.
      const meta = probed as ProbeResult | null;
      if (
        err.code === 'targetTooSmall' &&
        msg.options.mode === 'target' &&
        meta?.video
      ) {
        const minAudioBps =
          msg.file.size <= FFMPEG_MAX_INPUT_BYTES
            ? FFMPEG_MIN_AUDIO_BPS
            : WEBCODECS_MIN_AUDIO_BPS;
        const mb = minFeasibleTargetMB(meta, minAudioBps, msg.options.format);
        if (mb !== null && mb > msg.options.targetMB) suggestedTargetMB = mb;
      }
      post({ type: 'error', code: err.code, detail: err.message, suggestedTargetMB });
    } else {
      post({ type: 'error', code: 'unknown', detail: String(err) });
    }
  } finally {
    self.close();
  }
};
