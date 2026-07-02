import { parseFractionalNumber, parsePositiveInteger, parseDurationSeconds } from './parse.js';
import { resolveScaledDimensions } from './scale.js';
import type { ScaleMode } from './types.js';

export async function probeMediaInfo(ffprobePath: string, inputPath: string) {
  try {
    const result = await sigma.shell.run(ffprobePath, [
      '-v', 'error',
      '-show_format',
      '-show_streams',
      '-print_format', 'json',
      inputPath,
    ]);

    if (result.code !== 0 || !result.stdout) {
      return null;
    }

    const parsedOutput = JSON.parse(result.stdout);
    const streams = Array.isArray(parsedOutput.streams) ? parsedOutput.streams : [];
    const videoStream = streams.find((stream: { codec_type?: string }) => stream.codec_type === 'video');
    const audioStream = streams.find((stream: { codec_type?: string }) => stream.codec_type === 'audio');

    return {
      width: parsePositiveInteger(videoStream?.width),
      height: parsePositiveInteger(videoStream?.height),
      frameRate: parseFractionalNumber(videoStream?.avg_frame_rate)
        ?? parseFractionalNumber(videoStream?.r_frame_rate),
      durationSeconds: parseDurationSeconds(parsedOutput.format?.duration),
      videoCodec: videoStream?.codec_name ? String(videoStream.codec_name) : null,
      totalBitrate: parsePositiveInteger(parsedOutput.format?.bit_rate)
        ?? parsePositiveInteger(videoStream?.bit_rate),
      audioBitrate: parsePositiveInteger(audioStream?.bit_rate),
      audioChannels: parsePositiveInteger(audioStream?.channels),
      hasAudio: Boolean(audioStream),
    };
  } catch (probeError) {
    console.warn('[Media Converter] Failed to probe media info:', probeError);
    return null;
  }
}

export function formatMediaInfoSummary(
  mediaInfo: NonNullable<Awaited<ReturnType<typeof probeMediaInfo>>>,
  translate: (key: string, params?: Record<string, string | number>) => string,
) {
  const parts: string[] = [];

  if (mediaInfo.width !== null && mediaInfo.height !== null) {
    parts.push(`${mediaInfo.width}x${mediaInfo.height}`);
  }

  if (mediaInfo.frameRate !== null) {
    parts.push(translate('sourceFps', { fps: mediaInfo.frameRate.toFixed(2) }));
  }

  if (mediaInfo.durationSeconds !== null) {
    parts.push(formatDurationLabel(mediaInfo.durationSeconds));
  }

  if (mediaInfo.videoCodec) {
    parts.push(mediaInfo.videoCodec.toUpperCase());
  }

  return parts.join(', ');
}

function formatDurationLabel(durationSeconds: number) {
  const totalSeconds = Math.round(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function estimateGifOutputBytes(
  width: number,
  height: number,
  fps: number,
  durationSeconds: number,
) {
  return Math.round(width * height * fps * durationSeconds * 0.35);
}

export function formatByteSizeLabel(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(0)} KB`;
  }
  return `${sizeBytes} B`;
}

export function resolveOutputDimensions(
  scaleMode: ScaleMode | string,
  scaleWidth: string,
  scaleHeight: string,
  scalePercent: string,
  sourceWidth: number | null,
  sourceHeight: number | null,
) {
  return resolveScaledDimensions(
    scaleMode,
    scaleWidth,
    scaleHeight,
    scalePercent,
    sourceWidth,
    sourceHeight,
  );
}
