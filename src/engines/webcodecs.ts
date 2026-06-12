import {
  ALL_FORMATS,
  BlobSource,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  type StreamTargetChunk,
} from 'mediabunny';
import { CompressError } from '../core/types.ts';
import type { Engine } from './types.ts';

/**
 * Collects the muxer's positioned writes and assembles them into a Blob
 * without ever allocating one contiguous output buffer. With
 * `fastStart: false` writes are sequential except a small backpatch of the
 * mdat size, so the sweep below stays trivial in practice; it is still
 * written to be correct for arbitrary overlapping writes (last write wins).
 */
class BlobChunkCollector {
  private chunks: { position: number; data: Uint8Array; seq: number }[] = [];
  private seq = 0;

  writable(): WritableStream<StreamTargetChunk> {
    return new WritableStream({
      write: (chunk) => {
        this.chunks.push({
          position: chunk.position,
          data: chunk.data,
          seq: this.seq++,
        });
      },
    });
  }

  toBlob(type: string): Blob {
    const boundaries = new Set<number>();
    for (const c of this.chunks) {
      boundaries.add(c.position);
      boundaries.add(c.position + c.data.byteLength);
    }
    const points = [...boundaries].sort((a, b) => a - b);
    const parts: Uint8Array[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i]!;
      const end = points[i + 1]!;
      let winner: { position: number; data: Uint8Array; seq: number } | null =
        null;
      for (const c of this.chunks) {
        if (
          c.position <= start &&
          c.position + c.data.byteLength >= end &&
          (!winner || c.seq > winner.seq)
        ) {
          winner = c;
        }
      }
      if (winner) {
        parts.push(
          winner.data.subarray(start - winner.position, end - winner.position),
        );
      }
      // Gaps (no covering write) should not occur with the MP4 muxer; if one
      // did, the resulting file would be corrupt anyway, so we don't zero-fill.
    }
    this.chunks = [];
    return new Blob(parts as BlobPart[], { type });
  }
}

export const webcodecsEngine: Engine = {
  async run(file, plan, { onProgress }, signal) {
    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });
    const collector = new BlobChunkCollector();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: false }),
      // chunked: accumulate ~16 MiB before emitting, keeps chunk count low
      target: new StreamTarget(collector.writable(), { chunked: true }),
    });

    let conversion: Conversion;
    try {
      conversion = await Conversion.init({
        input,
        output,
        video: {
          codec: 'avc',
          width: plan.width,
          height: plan.height,
          fit: 'contain',
          frameRate: plan.fps,
          bitrate: plan.videoBps,
          keyFrameInterval: plan.keyFrameIntervalS,
          forceTranscode: true,
        },
        audio:
          plan.audioBps === null
            ? {} // copy packets unchanged when the container allows it
            : { codec: 'aac', bitrate: plan.audioBps, forceTranscode: true },
        showWarnings: false,
      });
    } catch (err) {
      input.dispose();
      throw new CompressError('decode', String(err));
    }

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map((d) => d.reason)
        .join(', ');
      input.dispose();
      throw new CompressError('decode', `conversion invalid: ${reasons}`);
    }

    if (signal.aborted) {
      input.dispose();
      throw new CompressError('cancelled');
    }

    // mediabunny 1.46: after cancel(), execute() can stay pending forever
    // (one internal track promise never settles), so we can't rely on it
    // rejecting. Race it against the abort signal; actual resource
    // reclamation is guaranteed by terminating the per-job worker.
    const aborted = new Promise<never>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          void conversion.cancel();
          reject(new CompressError('cancelled'));
        },
        { once: true },
      );
    });
    conversion.onProgress = (p) => onProgress(p);

    try {
      await Promise.race([conversion.execute(), aborted]);
      return collector.toBlob('video/mp4');
    } catch (err) {
      if (
        err instanceof CompressError ||
        err instanceof ConversionCanceledError
      ) {
        throw err instanceof CompressError ? err : new CompressError('cancelled');
      }
      throw new CompressError('encode', String(err));
    } finally {
      input.dispose();
    }
  },
};
