import type { Engine } from '../engines/types';
import { probe } from './probe';
import { buildPlan, MAX_ATTEMPTS, retryVideoBps } from './targetSize';
import {
  CompressError,
  type CompressOptions,
  type EngineName,
  type ProbeResult,
  type ResultStats,
} from './types';

export interface CompressCallbacks {
  onProbe: (meta: ProbeResult) => void;
  onEngine: (engine: EngineName) => void;
  onProgress: (
    fraction: number,
    stage: 'encode' | 'retry',
    attempt: number,
  ) => void;
}

export interface SelectedEngine {
  name: EngineName;
  engine: Engine;
}

/**
 * Full compress flow: probe → plan → encode → verify size → retry smaller
 * if the encoder overshot. Never returns a blob larger than the target.
 */
export async function compress(
  file: File,
  options: CompressOptions,
  selectEngine: (meta: ProbeResult) => Promise<SelectedEngine>,
  callbacks: CompressCallbacks,
  signal: AbortSignal,
): Promise<{ blob: Blob; stats: ResultStats }> {
  const t0 = performance.now();
  const meta = await probe(file);
  callbacks.onProbe(meta);

  const { name, engine } = await selectEngine(meta);
  callbacks.onEngine(name);

  let plan = buildPlan(options, meta);
  let blob: Blob | null = null;
  let attempt = 0;

  for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const stage = attempt === 1 ? 'encode' : 'retry';
    blob = await engine.run(
      file,
      plan,
      { onProgress: (f) => callbacks.onProgress(f, stage, attempt) },
      signal,
    );
    if (plan.targetBytes === null || blob.size <= plan.targetBytes) break;
    if (attempt === MAX_ATTEMPTS) {
      throw new CompressError(
        'encode',
        `output ${blob.size} bytes still over target after ${MAX_ATTEMPTS} attempts`,
      );
    }
    plan = buildPlan(options, meta, retryVideoBps(plan, blob.size));
  }

  return {
    blob: blob!,
    stats: {
      inBytes: file.size,
      outBytes: blob!.size,
      width: plan.width,
      height: plan.height,
      fps: plan.fps,
      videoKbps: Math.round(plan.videoBps / 1000),
      audioKbps: plan.audioBps === null ? null : Math.round(plan.audioBps / 1000),
      engine: name,
      attempts: attempt,
      wallMs: Math.round(performance.now() - t0),
    },
  };
}
