import {
  canDecodeVideo,
  canEncodeAudio,
  canEncodeVideo,
  VIDEO_CODECS,
  type VideoCodec,
} from 'mediabunny';
import type { BudgetPlan } from './targetSize.ts';
import type { EngineName, ProbeResult } from './types.ts';

export interface EngineDecision {
  name: EngineName;
  /** Why the fallback was chosen — surfaced in debug logging only. */
  reason: string;
}

const hasWebCodecs = () =>
  typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';

/**
 * Decide which engine can run this job. `plan` must have been built with
 * WebCodecs audio caps; the caller switches to ffmpeg caps when we say so.
 * Never sniffs user agents — capability checks only.
 */
export async function selectEngine(
  meta: ProbeResult,
  plan: BudgetPlan,
): Promise<EngineDecision> {
  if (!hasWebCodecs()) {
    return { name: 'ffmpeg', reason: 'no WebCodecs API' };
  }

  const codec = meta.video.codec;
  if (!codec || !(VIDEO_CODECS as readonly string[]).includes(codec)) {
    return { name: 'ffmpeg', reason: `unknown codec ${codec}` };
  }
  if (
    !(await canDecodeVideo(codec as VideoCodec, {
      codedWidth: meta.video.width,
      codedHeight: meta.video.height,
    }))
  ) {
    return { name: 'ffmpeg', reason: `cannot decode ${codec}` };
  }
  if (
    !(await canEncodeVideo('avc', {
      width: plan.width,
      height: plan.height,
      bitrate: Math.max(plan.videoBps, 1),
    }))
  ) {
    return { name: 'ffmpeg', reason: 'cannot encode h264' };
  }
  if (
    plan.audioBps !== null &&
    !(await canEncodeAudio('aac', { bitrate: plan.audioBps }))
  ) {
    return { name: 'ffmpeg', reason: 'cannot encode aac' };
  }
  return { name: 'webcodecs', reason: 'supported' };
}
