import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { CompressError, type ProbeResult } from './types.ts';

/**
 * Reads container headers only — cheap even for multi-GB files because
 * BlobSource reads byte ranges on demand.
 */
export async function probe(file: File): Promise<ProbeResult> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const format = await input.getFormat();
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new CompressError('notVideo', 'no video track');

    const audio = await input.getPrimaryAudioTrack();
    const durationS = await input.computeDuration();
    // Sample packets for fps/frame-count estimates without scanning the file.
    const stats = await video.computePacketStats(200);
    const fps = stats.averagePacketRate || 30;

    return {
      container: format.name,
      durationS,
      video: {
        codec: await video.getCodec(),
        width: video.displayWidth,
        height: video.displayHeight,
        fps,
        frameCount: Math.max(1, Math.round(fps * durationS)),
        // getAverageBitrate() is often null (not in container metadata);
        // packet-sampled stats always produce a usable estimate.
        bitrate: stats.averageBitrate || null,
      },
      audio: audio
        ? {
            codec: await audio.getCodec(),
            bitrate:
              (await audio.getAverageBitrate()) ??
              (await audio.computePacketStats(200)).averageBitrate ??
              null,
          }
        : null,
    };
  } catch (err) {
    if (err instanceof CompressError) throw err;
    throw new CompressError('notVideo', String(err));
  } finally {
    input.dispose();
  }
}
