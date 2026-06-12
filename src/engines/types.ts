import type { EncodePlan } from '../core/types.ts';

export interface EngineRunCallbacks {
  /** progress in [0, 1] over the encode stage */
  onProgress: (fraction: number) => void;
}

export interface Engine {
  run(
    file: File,
    plan: EncodePlan,
    callbacks: EngineRunCallbacks,
    signal: AbortSignal,
  ): Promise<Blob>;
}
