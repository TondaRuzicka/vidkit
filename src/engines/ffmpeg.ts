import { CompressError, type EncodePlan, type ProbeResult } from '../core/types.ts';
import type { Engine } from './types.ts';

/** ffmpeg.wasm exec args for one plan, branched by output kind/codec. */
function buildArgs(plan: EncodePlan, inPath: string, outName: string): string[] {
  const o = plan.output;
  const base = ['-hide_banner', '-i', inPath];

  if (o.kind === 'audio') {
    const codec = o.audioCodec === 'mp3' ? 'libmp3lame' : 'aac';
    return [
      ...base, '-vn',
      '-c:a', codec, '-b:a', String(plan.audioBps ?? 128_000), '-ac', '2',
      '-y', outName,
    ];
  }

  if (o.kind === 'animation') {
    // Two-pass palette in one graph: best-quality GIF, no audio track.
    const vf =
      `fps=${plan.fps},scale=${plan.width}:-1:flags=lanczos,` +
      `split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer`;
    return [...base, '-an', '-vf', vf, '-loop', '0', '-y', outName];
  }

  // Video: VP9 for WebM, otherwise H.264.
  const videoArgs =
    o.videoCodec === 'vp9'
      ? // libvpx-vp9 crashes the single-thread wasm core (OOB); VP8 is stable
        // and still WebM. realtime+cpu-used keeps the software encode bearable.
        ['-c:v', 'libvpx', '-b:v', String(plan.videoBps), '-deadline', 'realtime', '-cpu-used', '8', '-pix_fmt', 'yuv420p']
      : ['-c:v', 'libx264', '-preset', 'veryfast', '-b:v', String(plan.videoBps),
         '-maxrate', String(Math.floor(plan.videoBps * 1.05)), '-bufsize', String(plan.videoBps * 2),
         '-pix_fmt', 'yuv420p'];
  const audioArgs =
    plan.audioBps === null
      ? ['-c:a', 'copy']
      : o.audioCodec === 'opus'
        ? ['-c:a', 'libopus', '-b:a', String(plan.audioBps)]
        : ['-c:a', 'aac', '-b:a', String(plan.audioBps), '-ac', '2'];
  return [
    ...base,
    ...videoArgs,
    '-vf', `scale=${plan.width}:${plan.height}:flags=bicubic`,
    '-r', String(plan.fps),
    '-g', String(plan.fps * plan.keyFrameIntervalS),
    ...audioArgs,
    '-y', outName,
  ];
}

/**
 * ffmpeg.wasm fallback engine. Everything here is lazy: the ~31 MB wasm core
 * is fetched (same-origin, /ffmpeg/) only when this engine is actually used.
 *
 * wasm32 address-space reality: input is WORKERFS-mounted (never copied into
 * the heap), but decode buffers + x264 state + MEMFS output must fit in
 * <4 GB. Inputs over the gate below fail fast with a clear message instead
 * of OOM-crashing minutes in.
 */
export const FFMPEG_MAX_INPUT_BYTES = 1_500_000_000;

/** Lowest AAC bitrate the bundled encoder handles comfortably. */
export const FFMPEG_MIN_AUDIO_BPS = 24_000;

const INPUT_DIR = '/input';

type FFmpegInstance = import('@ffmpeg/ffmpeg').FFmpeg;

let instance: FFmpegInstance | null = null;
let logBuffer: string[] = [];

/** Load (once per worker) and return the shared FFmpeg instance. */
async function getFFmpeg(): Promise<FFmpegInstance> {
  if (instance) return instance;
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);
  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    logBuffer.push(message);
    if (logBuffer.length > 400) logBuffer.shift();
  });
  try {
    // blob: URLs keep the core's inner import() out of the bundler's hands.
    // Same-origin fetch — the core is self-hosted under /ffmpeg/.
    // The wasm ships gzipped (~9.7 MB) so it clears Cloudflare Pages' 25 MiB
    // per-file limit; we inflate it here before handing it to the loader.
    await ffmpeg.load({
      coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
      wasmURL: await gunzipToBlobURL('/ffmpeg/ffmpeg-core.wasm.bin', 'application/wasm'),
    });
  } catch (err) {
    throw new CompressError('noEngine', `ffmpeg load failed: ${err}`);
  }
  instance = ffmpeg;
  return ffmpeg;
}

/**
 * Fetch a gzip-compressed asset (same-origin), inflate it with the platform
 * DecompressionStream, and hand back a blob: URL — same contract as
 * @ffmpeg/util's toBlobURL, but for the compressed core. Used so the 31 MB
 * wasm can ship as a <10 MB file and stay under Cloudflare's per-file limit.
 */
async function gunzipToBlobURL(url: string, mime: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`fetch ${url}: ${res.status}`);
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

async function mountInput(ffmpeg: FFmpegInstance, file: File): Promise<string> {
  const { FFFSType } = await import('@ffmpeg/ffmpeg');
  // Sanitized fixed name: WORKERFS exposes the File under its own name.
  const safe = new File([file], 'in' + (file.name.match(/\.\w+$/)?.[0] ?? ''), {
    type: file.type,
  });
  await ffmpeg.createDir(INPUT_DIR);
  await ffmpeg.mount(FFFSType.WORKERFS, { files: [safe] }, INPUT_DIR);
  return `${INPUT_DIR}/${safe.name}`;
}

async function unmountInput(ffmpeg: FFmpegInstance): Promise<void> {
  try {
    await ffmpeg.unmount(INPUT_DIR);
    await ffmpeg.deleteDir(INPUT_DIR);
  } catch {
    // best-effort; the worker dies after the job anyway
  }
}

/**
 * Probe via ffmpeg's own stream info dump — used when mediabunny can't parse
 * the container (AVI and friends). `-i` with no output exits non-zero but
 * logs Duration/Stream lines, which is all we need.
 */
export async function ffmpegProbe(file: File): Promise<ProbeResult> {
  assertSize(file);
  const ffmpeg = await getFFmpeg();
  const path = await mountInput(ffmpeg, file);
  logBuffer = [];
  try {
    await ffmpeg.exec(['-hide_banner', '-i', path]);
  } catch {
    // expected: no output specified
  }
  const log = logBuffer.join('\n');
  await unmountInput(ffmpeg);

  const dur = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const video = log.match(
    /Stream #[^\n]*Video:\s*(\w+)[^\n]*?\s(\d{2,5})x(\d{2,5})[^\n]*/,
  );
  const audio = log.match(/Stream #[^\n]*Audio:\s*(\w+)[^\n]*/);
  // Accept audio-only inputs (.m4a, .wav …): reject only when neither stream
  // is identifiable. Duration is still required to plan anything.
  if (!dur || (!video && !audio)) {
    throw new CompressError('notVideo', 'ffmpeg could not identify streams');
  }
  const durationS =
    Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  const aBitrateMatch = audio?.[0]?.match(/(\d+)\s*kb\/s/);

  let videoMeta: ProbeResult['video'] = null;
  if (video) {
    const fpsMatch = video[0]!.match(/(\d+(?:\.\d+)?)\s*fps/);
    const vBitrateMatch = video[0]!.match(/(\d+)\s*kb\/s/);
    const fps = fpsMatch ? Number(fpsMatch[1]) : 30;
    videoMeta = {
      codec: video[1] ?? null,
      width: Number(video[2]),
      height: Number(video[3]),
      fps,
      frameCount: Math.max(1, Math.round(fps * durationS)),
      bitrate: vBitrateMatch ? Number(vBitrateMatch[1]) * 1000 : null,
    };
  }

  return {
    container: 'ffmpeg:' + (file.name.match(/\.(\w+)$/)?.[1] ?? 'unknown'),
    durationS,
    video: videoMeta,
    audio: audio
      ? {
          codec: audio[1] ?? null,
          bitrate: aBitrateMatch ? Number(aBitrateMatch[1]) * 1000 : null,
        }
      : null,
  };
}

function assertSize(file: File): void {
  if (file.size > FFMPEG_MAX_INPUT_BYTES) {
    throw new CompressError(
      'fileTooLargeForFallback',
      `${file.size} bytes exceeds wasm fallback limit`,
    );
  }
}

export const ffmpegEngine: Engine = {
  async run(file, plan, { onProgress }, signal) {
    assertSize(file);
    if (signal.aborted) throw new CompressError('cancelled');
    const ffmpeg = await getFFmpeg();
    const path = await mountInput(ffmpeg, file);

    const onProgressEvent = ({ progress }: { progress: number }) =>
      onProgress(Math.min(Math.max(progress, 0), 1));
    ffmpeg.on('progress', onProgressEvent);

    const outName = `out.${plan.output.ext}`;
    try {
      const code = await ffmpeg.exec(
        buildArgs(plan, path, outName),
        undefined,
        { signal },
      );
      if (signal.aborted) throw new CompressError('cancelled');
      if (code !== 0) {
        throw new CompressError(
          'encode',
          `ffmpeg exited ${code}: ${logBuffer.slice(-5).join(' | ')}`,
        );
      }
      const data = (await ffmpeg.readFile(outName)) as Uint8Array;
      await ffmpeg.deleteFile(outName);
      return new Blob([data as BlobPart], { type: plan.output.mime });
    } catch (err) {
      if (signal.aborted || err instanceof CompressError) {
        throw signal.aborted ? new CompressError('cancelled') : err;
      }
      throw new CompressError('encode', String(err));
    } finally {
      ffmpeg.off('progress', onProgressEvent);
      await unmountInput(ffmpeg);
    }
  },
};
