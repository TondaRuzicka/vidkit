import {
  FFMPEG_MIN_AUDIO_BPS,
  ffmpegEngine,
  ffmpegProbe,
} from '../engines/ffmpeg';
import type { Engine } from '../engines/types';
import { webcodecsEngine } from '../engines/webcodecs';
import { selectEngine } from './engineSelect';
import { probe } from './probe';
import {
  buildPlan,
  MAX_ATTEMPTS,
  retryVideoBps,
  WEBCODECS_MIN_AUDIO_BPS,
  type BudgetPlan,
} from './targetSize';
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

const ENGINES: Record<
  EngineName,
  { engine: Engine; minAudioBps: number }
> = {
  webcodecs: { engine: webcodecsEngine, minAudioBps: WEBCODECS_MIN_AUDIO_BPS },
  ffmpeg: { engine: ffmpegEngine, minAudioBps: FFMPEG_MIN_AUDIO_BPS },
};

/** Probe with mediabunny; fall back to ffmpeg's parser (AVI etc.). */
async function probeAny(
  file: File,
): Promise<{ meta: ProbeResult; forcedEngine: EngineName | null }> {
  try {
    return { meta: await probe(file), forcedEngine: null };
  } catch (err) {
    if (err instanceof CompressError && err.code === 'notVideo') {
      // mediabunny can't read the container — if ffmpeg can, it also has
      // to do the conversion.
      return { meta: await ffmpegProbe(file), forcedEngine: 'ffmpeg' };
    }
    throw err;
  }
}

/** Build the plan under an engine's audio constraints. */
function planFor(
  options: CompressOptions,
  meta: ProbeResult,
  engine: EngineName,
  videoBpsOverride?: number,
): BudgetPlan {
  return buildPlan(options, meta, videoBpsOverride, ENGINES[engine].minAudioBps);
}

async function runWithRetries(
  file: File,
  options: CompressOptions,
  meta: ProbeResult,
  engineName: EngineName,
  callbacks: CompressCallbacks,
  signal: AbortSignal,
): Promise<{ blob: Blob; plan: BudgetPlan; attempts: number }> {
  const { engine } = ENGINES[engineName];
  let plan = planFor(options, meta, engineName);
  for (let attempt = 1; ; attempt++) {
    const stage = attempt === 1 ? 'encode' : 'retry';
    const blob = await engine.run(
      file,
      plan,
      { onProgress: (f) => callbacks.onProgress(f, stage, attempt) },
      signal,
    );
    if (plan.targetBytes === null || blob.size <= plan.targetBytes) {
      return { blob, plan, attempts: attempt };
    }
    if (attempt === MAX_ATTEMPTS) {
      throw new CompressError(
        'encode',
        `output ${blob.size} bytes still over target after ${MAX_ATTEMPTS} attempts`,
      );
    }
    plan = planFor(options, meta, engineName, retryVideoBps(plan, blob.size));
  }
}

/**
 * Full flow: probe → engine choice → plan → encode → verify ≤ target.
 * WebCodecs jobs that fail mid-flight reroute once to ffmpeg before erroring.
 */
export async function compress(
  file: File,
  options: CompressOptions,
  callbacks: CompressCallbacks,
  signal: AbortSignal,
): Promise<{ blob: Blob; stats: ResultStats }> {
  const t0 = performance.now();
  const { meta, forcedEngine } = await probeAny(file);
  callbacks.onProbe(meta);

  let engineName: EngineName;
  if (forcedEngine) {
    engineName = forcedEngine;
    planFor(options, meta, engineName); // feasibility check, throws early
  } else {
    let plan: BudgetPlan;
    try {
      plan = planFor(options, meta, 'webcodecs');
      engineName = (await selectEngine(meta, plan)).name;
    } catch (err) {
      // Infeasible under WebCodecs' AAC floor (e.g. long video, tiny
      // target) but fine with ffmpeg's software encoder at 24-48k audio.
      if (err instanceof CompressError && err.code === 'targetTooSmall') {
        planFor(options, meta, 'ffmpeg'); // throws targetTooSmall if truly impossible
        engineName = 'ffmpeg';
      } else {
        throw err;
      }
    }
  }
  callbacks.onEngine(engineName);

  let result;
  try {
    result = await runWithRetries(file, options, meta, engineName, callbacks, signal);
  } catch (err) {
    const reroutable =
      engineName === 'webcodecs' &&
      err instanceof CompressError &&
      (err.code === 'decode' || err.code === 'encode');
    if (!reroutable) throw err;
    engineName = 'ffmpeg';
    callbacks.onEngine(engineName);
    result = await runWithRetries(file, options, meta, engineName, callbacks, signal);
  }

  const { blob, plan, attempts } = result;
  return {
    blob,
    stats: {
      inBytes: file.size,
      outBytes: blob.size,
      width: plan.width,
      height: plan.height,
      fps: plan.fps,
      videoKbps: Math.round(plan.videoBps / 1000),
      audioKbps: plan.audioBps === null ? null : Math.round(plan.audioBps / 1000),
      engine: engineName,
      attempts,
      wallMs: Math.round(performance.now() - t0),
    },
  };
}
