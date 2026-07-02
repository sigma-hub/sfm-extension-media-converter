import { getAudioCodecForFormat, getVideoCodecForFormat } from './ffmpeg.js';
import { convertSingleFile } from './ffmpeg-runner.js';
import { getEntryInputSizeBytes, getFileSizeBytesByPath } from './output.js';
import { probeMediaInfo } from './probe.js';
import type { ClassifiableEntry, MediaInfo } from './types.js';

function getReduceVideoOutputExtension(normalizedExtension: string) {
  const ext = normalizedExtension.toLowerCase();
  if (ext === 'wmv' || ext === 'flv' || ext === '3gp') {
    return 'mp4';
  }
  return ext;
}

function getReduceImageOutputExtension(normalizedExtension: string) {
  const ext = normalizedExtension.toLowerCase();
  if (ext === 'bmp' || ext === 'tif' || ext === 'tiff') {
    return 'png';
  }
  return ext;
}

function mapExtensionToVideoFormatForReduce(outputExtension: string) {
  const ext = outputExtension.toLowerCase();
  if (ext === 'm4v' || ext === '3gp') return 'mp4';
  if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(ext)) return ext;
  return 'mp4';
}

function getReduceVideoCrf(videoFormat: string, mediaInfo: MediaInfo | null, mode: string) {
  const height = mediaInfo?.height ?? 1080;

  if (videoFormat === 'webm') {
    if (mode === 'fallback') {
      if (height >= 2160) return '36';
      if (height >= 1080) return '35';
      if (height >= 720) return '34';
      return '33';
    }

    if (height >= 2160) return '34';
    if (height >= 1080) return '33';
    if (height >= 720) return '32';
    return '31';
  }

  if (mode === 'fallback') {
    if (height >= 2160) return '29';
    if (height >= 1080) return '27';
    if (height >= 720) return '26';
    return '25';
  }

  if (height >= 2160) return '27';
  if (height >= 1080) return '25';
  if (height >= 720) return '24';
  return '23';
}

function getReduceVideoScaleFilter(mediaInfo: MediaInfo | null) {
  const width = mediaInfo?.width ?? null;
  const height = mediaInfo?.height ?? null;
  const requiresDownscaling = width !== null && height !== null
    ? Math.max(width, height) > 1920
    : true;

  if (requiresDownscaling) {
    return 'scale=1920:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p';
  }

  return 'format=yuv420p';
}

function getReduceAudioBitrateKbps(mediaInfo: MediaInfo | null, videoFormat: string, mode: string) {
  if (mediaInfo && !mediaInfo.hasAudio) {
    return null;
  }

  const sourceAudioBitrateKbps = mediaInfo?.audioBitrate
    ? Math.round(mediaInfo.audioBitrate / 1000)
    : null;
  const maximumTargetKbps = videoFormat === 'webm'
    ? (mode === 'fallback' ? 96 : 112)
    : (mode === 'fallback' ? 96 : 128);
  const channelCount = mediaInfo?.audioChannels ?? 2;
  const minimumTargetKbps = channelCount > 2 ? 96 : (channelCount === 1 ? 48 : 64);

  if (sourceAudioBitrateKbps !== null) {
    if (sourceAudioBitrateKbps < minimumTargetKbps) {
      return sourceAudioBitrateKbps;
    }

    return Math.max(minimumTargetKbps, Math.min(sourceAudioBitrateKbps, maximumTargetKbps));
  }

  return maximumTargetKbps;
}

function getReduceVideoBitrateKbps(mediaInfo: MediaInfo | null, audioBitrateKbps: number | null, mode: string) {
  if (!mediaInfo?.totalBitrate) {
    return null;
  }

  const sourceTotalBitrateKbps = Math.round(mediaInfo.totalBitrate / 1000);
  const targetRatio = mode === 'fallback' ? 0.62 : 0.78;
  const desiredTotalBitrateKbps = Math.max(350, Math.round(sourceTotalBitrateKbps * targetRatio));
  const desiredVideoBitrateKbps = desiredTotalBitrateKbps - (audioBitrateKbps || 0);

  return desiredVideoBitrateKbps >= 250 ? desiredVideoBitrateKbps : null;
}

function shouldUseFaststart(outputExtension: string) {
  return outputExtension === 'mp4' || outputExtension === 'm4v' || outputExtension === 'mov';
}

export function buildReduceVideoArgs(
  inputPath: string,
  outputPath: string,
  normalizedExtension: string,
  mediaInfo: MediaInfo | null,
  mode = 'default',
) {
  const ext = normalizedExtension.toLowerCase();
  const outputExt = getReduceVideoOutputExtension(ext);
  const videoFormat = mapExtensionToVideoFormatForReduce(outputExt);
  const videoCodec = getVideoCodecForFormat(videoFormat);
  const audioCodec = getAudioCodecForFormat(videoFormat);
  const audioBitrateKbps = getReduceAudioBitrateKbps(mediaInfo, videoFormat, mode);
  const videoBitrateKbps = getReduceVideoBitrateKbps(mediaInfo, audioBitrateKbps, mode);
  const crf = getReduceVideoCrf(videoFormat, mediaInfo, mode);
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'info',
    '-i',
    inputPath,
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-vf',
    getReduceVideoScaleFilter(mediaInfo),
    '-c:v',
    videoCodec,
  ];

  if (videoCodec === 'libvpx-vp9') {
    args.push(
      '-b:v', '0',
      '-crf', crf,
      '-deadline', 'good',
      '-cpu-used', mode === 'fallback' ? '5' : '4',
      '-row-mt', '1',
      '-tile-columns', '2',
      '-frame-parallel', '1',
    );
  } else {
    args.push(
      '-crf', crf,
      '-preset', mode === 'fallback' ? 'slow' : 'medium',
    );

    if (shouldUseFaststart(outputExt)) {
      args.push('-movflags', '+faststart');
    }
  }

  if (videoBitrateKbps !== null) {
    args.push(
      '-maxrate',
      `${videoBitrateKbps}k`,
      '-bufsize',
      `${videoBitrateKbps * 2}k`,
    );
  }

  if (mediaInfo?.frameRate && mediaInfo.frameRate > 60) {
    args.push('-r', '60');
  }

  if (audioBitrateKbps === null) {
    args.push('-an');
  } else {
    args.push('-c:a', audioCodec, '-b:a', `${audioBitrateKbps}k`);
  }

  args.push(outputPath);
  return args;
}

export function buildReduceImageArgs(inputPath: string, outputPath: string, normalizedExtension: string) {
  const outputExt = getReduceImageOutputExtension(normalizedExtension.toLowerCase());
  const args = ['-y', '-hide_banner', '-loglevel', 'info', '-i', inputPath];

  if (outputExt === 'png') {
    args.push('-c:v', 'png', '-compression_level', '9', '-pred', 'mixed');
  } else if (outputExt === 'jpg' || outputExt === 'jpeg') {
    args.push('-q:v', '3');
  } else if (outputExt === 'webp') {
    args.push('-c:v', 'libwebp', '-preset', 'picture', '-quality', '84');
  } else if (outputExt === 'avif') {
    args.push('-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '26');
  } else if (outputExt === 'gif') {
    args.push(
      '-filter_complex',
      'split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg',
    );
  } else {
    args.push('-q:v', '3');
  }

  if (outputExt !== 'gif') {
    args.push('-frames:v', '1', '-update', '1');
  }

  args.push('-map_metadata', '-1', outputPath);
  return args;
}

export function getReduceOutputExtension(fileType: 'video' | 'image', extension: string) {
  const normalizedExtension = extension.toLowerCase().replace(/^\./, '');
  return fileType === 'video'
    ? getReduceVideoOutputExtension(normalizedExtension)
    : getReduceImageOutputExtension(normalizedExtension);
}

export async function convertVideoWithFallback({
  ffmpegPath,
  ffprobePath,
  file,
  outputPath,
  extension,
  progressCallback,
  cancellationToken,
}: {
  ffmpegPath: string;
  ffprobePath: string;
  file: ClassifiableEntry;
  outputPath: string;
  extension: string;
  progressCallback: (message: string) => void;
  cancellationToken: {
    isCancellationRequested: boolean;
    onCancellationRequested: (callback: () => void) => void;
  };
}) {
  const mediaInfo = ffprobePath ? await probeMediaInfo(ffprobePath, file.path) : null;
  const inputSizeBytes = getEntryInputSizeBytes(file);

  const firstResult = await convertSingleFile(
    ffmpegPath,
    file.path,
    buildReduceVideoArgs(file.path, outputPath, extension, mediaInfo, 'default'),
    progressCallback,
    cancellationToken,
  );

  if (firstResult.cancelled || firstResult.code !== 0) {
    return {
      result: firstResult,
      inputSizeBytes,
      outputSizeBytes: await getFileSizeBytesByPath(outputPath),
    };
  }

  let outputSizeBytes = await getFileSizeBytesByPath(outputPath);
  const shouldRetryWithStrongerReduction = inputSizeBytes !== null
    && outputSizeBytes !== null
    && outputSizeBytes >= inputSizeBytes;

  if (!shouldRetryWithStrongerReduction) {
    return {
      result: firstResult,
      inputSizeBytes,
      outputSizeBytes,
    };
  }

  const fallbackResult = await convertSingleFile(
    ffmpegPath,
    file.path,
    buildReduceVideoArgs(file.path, outputPath, extension, mediaInfo, 'fallback'),
    progressCallback,
    cancellationToken,
  );

  outputSizeBytes = await getFileSizeBytesByPath(outputPath);

  return {
    result: fallbackResult,
    inputSizeBytes,
    outputSizeBytes,
  };
}

export async function convertImageForReduce({
  ffmpegPath,
  file,
  outputPath,
  extension,
  progressCallback,
  cancellationToken,
}: {
  ffmpegPath: string;
  file: ClassifiableEntry;
  outputPath: string;
  extension: string;
  progressCallback: (message: string) => void;
  cancellationToken: {
    isCancellationRequested: boolean;
    onCancellationRequested: (callback: () => void) => void;
  };
}) {
  const result = await convertSingleFile(
    ffmpegPath,
    file.path,
    buildReduceImageArgs(file.path, outputPath, extension),
    progressCallback,
    cancellationToken,
  );

  return {
    result,
    inputSizeBytes: getEntryInputSizeBytes(file),
    outputSizeBytes: await getFileSizeBytesByPath(outputPath),
  };
}
