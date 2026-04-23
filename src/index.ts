import type { ExtensionActivationContext, UIElement } from '@sigma-file-manager/api';

type ClassifiableEntry = {
  path: string;
  name: string;
  isDirectory: boolean;
  extension?: string | null;
  size?: number;
};

const t = sigma.i18n.extensionT;

const FFMPEG_BINARY_ID = 'ffmpeg';
const FFPROBE_BINARY_ID = 'ffprobe';
let cachedFfmpegBinaryPath: string | null = null;
let cachedFfprobeBinaryPath: string | null = null;

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'ts', 'mts', 'm4v', '3gp'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'avif', 'gif'];

function getVideoOutputFormats() {
  return [
    { value: 'mp4', label: t('formatMp4') },
    { value: 'mkv', label: t('formatMkv') },
    { value: 'webm', label: t('formatWebm') },
    { value: 'avi', label: t('formatAvi') },
    { value: 'mov', label: t('formatMov') },
    { value: 'gif', label: t('formatGif') },
  ];
}

function getVideoCodecModes() {
  return [
    { value: 'auto', label: t('autoCopy') },
    { value: 'copy', label: t('copy') },
  ];
}

function getVideoQualityOptions() {
  return [
    { value: '18', label: t('visuallyLossless') },
    { value: '23', label: t('highCrf23') },
    { value: '28', label: t('midCrf28') },
    { value: '35', label: t('lowCrf35') },
  ];
}

function getVideoFramerateOptions() {
  return [
    { value: 'original', label: t('keepOriginal') },
    { value: '60', label: t('fps60') },
    { value: '30', label: t('fps30') },
    { value: '24', label: t('fps24') },
    { value: '15', label: t('fps15') },
    { value: '10', label: t('fps10') },
  ];
}

function getVideoResolutionOptions() {
  return [
    { value: 'original', label: t('keepOriginal') },
    { value: '1080', label: t('res1080p') },
    { value: '720', label: t('res720p') },
    { value: '480', label: t('res480p') },
    { value: '360', label: t('res360p') },
  ];
}

function getVideoAudioOptions() {
  return [
    { value: 'keep', label: t('keepAudio') },
    { value: 'remove', label: t('removeAudio') },
    { value: 'copy', label: t('copyAudio') },
  ];
}

function getGifWidthOptions() {
  return [
    { value: 'original', label: t('keepOriginal') },
    { value: '640', label: t('width640') },
    { value: '480', label: t('width480') },
    { value: '320', label: t('width320') },
    { value: '240', label: t('width240') },
  ];
}

function getImageOutputFormats() {
  return [
    { value: 'png', label: t('formatPng') },
    { value: 'jpg', label: t('formatJpg') },
    { value: 'webp', label: t('formatWebp') },
    { value: 'avif', label: t('formatAvif') },
    { value: 'bmp', label: t('formatBmp') },
    { value: 'tiff', label: t('formatTiff') },
  ];
}

function getImageQualityOptions() {
  return [
    { value: '100', label: t('highest100') },
    { value: '90', label: t('high90') },
    { value: '75', label: t('medium75') },
    { value: '50', label: t('low50') },
  ];
}

function getImageResizeOptions() {
  return [
    { value: 'original', label: t('keepOriginal') },
    { value: '75%', label: t('scale75') },
    { value: '50%', label: t('scale50') },
    { value: '25%', label: t('scale25') },
    { value: '1920', label: t('width1920') },
    { value: '1280', label: t('width1280') },
    { value: '800', label: t('width800') },
  ];
}

function getFileExtension(filePath) {
  const ext = sigma.path.extname(filePath);
  return ext ? ext.substring(1).toLowerCase() : '';
}

function getFileNameWithoutExtension(filePath) {
  const base = sigma.path.basename(filePath);
  const ext = sigma.path.extname(base);
  return ext ? base.substring(0, base.length - ext.length) : base;
}

function getDirectoryFromPath(filePath) {
  if (!filePath) return null;
  return sigma.path.dirname(filePath);
}

function classifyFiles(entries: ClassifiableEntry[]) {
  const videoFiles: ClassifiableEntry[] = [];
  const imageFiles: ClassifiableEntry[] = [];
  const unsupported: ClassifiableEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      unsupported.push(entry);
      continue;
    }
    const extension = (entry.extension || getFileExtension(entry.path)).toLowerCase().replace(/^\./, '');
    if (VIDEO_EXTENSIONS.includes(extension)) {
      videoFiles.push(entry);
    } else if (IMAGE_EXTENSIONS.includes(extension)) {
      imageFiles.push(entry);
    } else {
      unsupported.push(entry);
    }
  }

  return { videoFiles, imageFiles, unsupported };
}

// --- FFmpeg binary management ---

async function ensureFfmpegInstalled() {
  if (cachedFfmpegBinaryPath) return cachedFfmpegBinaryPath;

  const ffmpegPath = await sigma.binary.getPath(FFMPEG_BINARY_ID);
  if (!ffmpegPath) {
    throw new Error(`FFmpeg binary is unavailable for ${sigma.platform.os} ${sigma.platform.arch}`);
  }

  cachedFfmpegBinaryPath = ffmpegPath;

  if (!sigma.platform.isMacos) {
    cachedFfprobeBinaryPath = ffmpegPath.replace(
      /ffmpeg(\.exe)?$/i,
      `ffprobe${sigma.platform.isWindows ? '.exe' : ''}`
    );
    console.log('[Media Converter] ffprobe expected at:', cachedFfprobeBinaryPath);
  }

  console.log('[Media Converter] ffmpeg available at:', ffmpegPath);

  return ffmpegPath;
}

async function ensureFfprobeInstalledMacos() {
  if (cachedFfprobeBinaryPath) return cachedFfprobeBinaryPath;

  const ffprobePath = await sigma.binary.getPath(FFPROBE_BINARY_ID);
  if (!ffprobePath) {
    throw new Error(`FFprobe binary is unavailable for ${sigma.platform.os} ${sigma.platform.arch}`);
  }

  cachedFfprobeBinaryPath = ffprobePath;
  console.log('[Media Converter] ffprobe available at:', ffprobePath);

  return ffprobePath;
}

async function ensureFfprobeAvailable() {
  if (sigma.platform.isMacos) {
    const ffprobePath = await ensureFfprobeInstalledMacos();
    const ffprobeExists = await sigma.fs.exists(ffprobePath);
    if (!ffprobeExists) {
      throw new Error('ffprobe binary is missing after installation');
    }
    return ffprobePath;
  }

  if (!cachedFfprobeBinaryPath) {
    await ensureFfmpegInstalled();
  }

  if (!cachedFfprobeBinaryPath) {
    throw new Error('ffprobe path could not be resolved');
  }

  const ffprobeExists = await sigma.fs.exists(cachedFfprobeBinaryPath);
  if (!ffprobeExists) {
    throw new Error('ffprobe binary is missing from the FFmpeg package');
  }

  return cachedFfprobeBinaryPath;
}

async function ensureFfmpegToolchainAvailable() {
  const ffmpegPath = await ensureFfmpegInstalled();
  const ffprobePath = await ensureFfprobeAvailable();

  return {
    ffmpegPath,
    ffprobePath,
  };
}

// --- Output path logic ---

function detectSeparator(filePath) {
  const lastBackslash = filePath.lastIndexOf('\\');
  const lastForwardSlash = filePath.lastIndexOf('/');
  if (lastBackslash === -1 && lastForwardSlash === -1) return sigma.platform.pathSeparator;
  return lastForwardSlash > lastBackslash ? '/' : '\\';
}

function buildParamSuffix(type, options) {
  const parts: string[] = [];

  if (type === 'video') {
    if (options.videoFormat === 'gif') {
      const fps = options.videoFramerate !== 'original' ? options.videoFramerate : '15';
      parts.push(`${fps}fps`);
      if (options.gifWidth !== 'original') {
        parts.push(`${options.gifWidth}w`);
      }
      if (options.gifHighQuality) {
        parts.push('hq');
      }
    } else if (options.videoCodecMode === 'copy') {
      parts.push('copy');
      if (options.videoAudio === 'remove') {
        parts.push('noaudio');
      }
    } else {
      parts.push(`crf${options.videoQuality}`);
      if (options.videoFramerate !== 'original') {
        parts.push(`${options.videoFramerate}fps`);
      }
      if (options.videoResolution !== 'original') {
        parts.push(`${options.videoResolution}p`);
      }
      if (options.videoAudio === 'remove') {
        parts.push('noaudio');
      }
    }
  } else {
    parts.push(`q${options.imageQuality}`);
    if (options.imageResize !== 'original') {
      if (options.imageResize.endsWith('%')) {
        const scale = parseInt(options.imageResize, 10) / 100;
        parts.push(`@${scale}`);
      } else {
        parts.push(`${options.imageResize}w`);
      }
    }
  }

  return parts.length > 0 ? '-' + parts.join('-') : '';
}

function getFileNameFromPath(filePath) {
  return sigma.path.basename(filePath);
}

function normalizeOutputNameKey(fileName) {
  return sigma.platform.isWindows ? fileName.toLowerCase() : fileName;
}

function buildExistingNamesSet(entries) {
  const nameSet = new Set<string>();
  for (const entry of entries) {
    const fileName = entry.name || getFileNameFromPath(entry.path);
    nameSet.add(normalizeOutputNameKey(fileName));
  }
  return nameSet;
}

async function buildExistingNamesSetForDirectory(directoryPath, fallbackEntries) {
  try {
    const directoryEntries = await sigma.fs.readDir(directoryPath);
    return buildExistingNamesSet(directoryEntries);
  } catch (readDirectoryError) {
    console.warn('[Media Converter] Could not read directory entries:', readDirectoryError);
    return buildExistingNamesSet(fallbackEntries || []);
  }
}

function resolveOutputFileName(baseName, extension, existingNamesSet) {
  const candidate = `${baseName}.${extension}`;
  const candidateKey = normalizeOutputNameKey(candidate);

  if (!existingNamesSet.has(candidateKey)) {
    existingNamesSet.add(candidateKey);
    return candidate;
  }

  for (let counter = 1; counter <= 999; counter++) {
    const numbered = `${baseName} (${counter}).${extension}`;
    const numberedKey = normalizeOutputNameKey(numbered);
    if (!existingNamesSet.has(numberedKey)) {
      existingNamesSet.add(numberedKey);
      return numbered;
    }
  }

  const fallback = `${baseName} (${Date.now()}).${extension}`;
  existingNamesSet.add(normalizeOutputNameKey(fallback));
  return fallback;
}

// --- Codec selection helpers ---

function getVideoCodecForFormat(format) {
  switch (format) {
    case 'mp4': return 'libx264';
    case 'mkv': return 'libx264';
    case 'webm': return 'libvpx-vp9';
    case 'avi': return 'libx264';
    case 'mov': return 'libx264';
    default: return 'libx264';
  }
}

function getAudioCodecForFormat(format) {
  switch (format) {
    case 'webm': return 'libopus';
    case 'mp4': return 'aac';
    case 'mkv': return 'aac';
    case 'avi': return 'mp3';
    case 'mov': return 'aac';
    default: return 'aac';
  }
}

// --- Build ffmpeg args ---

function buildVideoArgs(inputPath, outputPath, options) {
  if (options.videoFormat === 'gif') {
    return buildGifArgs(inputPath, outputPath, options);
  }

  const args = ['-y', '-hide_banner', '-loglevel', 'info', '-i', inputPath];

  if (options.videoCodecMode === 'copy') {
    args.push('-c:v', 'copy');
  } else {
    const codec = getVideoCodecForFormat(options.videoFormat);
    args.push('-c:v', codec);

    if (codec === 'libvpx-vp9') {
      args.push('-b:v', '0', '-crf', options.videoQuality || '18');
    } else {
      args.push('-crf', options.videoQuality || '18');
      args.push('-preset', 'medium');
    }

    if (options.videoFramerate && options.videoFramerate !== 'original') {
      args.push('-r', options.videoFramerate);
    }

    if (options.videoResolution && options.videoResolution !== 'original') {
      args.push('-vf', `scale=-2:${options.videoResolution}`);
    }
  }

  if (options.videoAudio === 'remove') {
    args.push('-an');
  } else if (options.videoAudio === 'copy' || options.videoCodecMode === 'copy') {
    args.push('-c:a', 'copy');
  } else {
    const audioCodec = getAudioCodecForFormat(options.videoFormat);
    args.push('-c:a', audioCodec);
  }

  args.push(outputPath);
  return args;
}

function buildGifArgs(inputPath, outputPath, options) {
  const fps = options.videoFramerate && options.videoFramerate !== 'original'
    ? options.videoFramerate
    : '15';

  const widthPart = options.gifWidth && options.gifWidth !== 'original'
    ? options.gifWidth
    : '-1';

  const scaleFilter = `fps=${fps},scale=${widthPart}:-1:flags=lanczos`;
  const paletteFilter = `${scaleFilter},split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg`;

  if (options.gifHighQuality !== false) {
    return [
      '-y', '-hide_banner', '-loglevel', 'info',
      '-i', inputPath,
      '-filter_complex', paletteFilter,
      outputPath,
    ];
  }

  return [
    '-y', '-hide_banner', '-loglevel', 'info',
    '-i', inputPath,
    '-vf', scaleFilter,
    outputPath,
  ];
}

function buildImageArgs(inputPath, outputPath, options) {
  const args = ['-y', '-hide_banner', '-loglevel', 'info', '-i', inputPath];
  const filters: string[] = [];

  if (options.imageResize && options.imageResize !== 'original') {
    if (options.imageResize.endsWith('%')) {
      const scale = parseInt(options.imageResize, 10) / 100;
      filters.push(`scale=iw*${scale}:ih*${scale}`);
    } else {
      filters.push(`scale=${options.imageResize}:-1`);
    }
  }

  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  const outputFormat = options.imageFormat || 'png';
  const quality = parseInt(options.imageQuality || '90', 10);

  if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
    const qscale = Math.max(1, Math.round(31 - (quality / 100) * 30));
    args.push('-q:v', String(qscale));
  } else if (outputFormat === 'webp') {
    args.push('-quality', String(quality));
  } else if (outputFormat === 'avif') {
    const crf = Math.round(63 - (quality / 100) * 63);
    args.push('-crf', String(crf));
  }

  args.push(outputPath);
  return args;
}

function getReduceVideoOutputExtension(normalizedExtension) {
  const ext = normalizedExtension.toLowerCase();
  if (ext === 'wmv' || ext === 'flv' || ext === '3gp') {
    return 'mp4';
  }
  return ext;
}

function getReduceImageOutputExtension(normalizedExtension) {
  const ext = normalizedExtension.toLowerCase();
  if (ext === 'bmp' || ext === 'tif' || ext === 'tiff') {
    return 'png';
  }
  return ext;
}

function mapExtensionToVideoFormatForReduce(outputExtension) {
  const ext = outputExtension.toLowerCase();
  if (ext === 'm4v' || ext === '3gp') return 'mp4';
  if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(ext)) return ext;
  return 'mp4';
}

function parsePositiveInteger(value) {
  const parsedValue = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function parsePositiveNumber(value) {
  const parsedValue = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function parseFractionalNumber(value) {
  if (!value || value === '0/0') {
    return null;
  }

  if (String(value).includes('/')) {
    const [numeratorValue, denominatorValue] = String(value).split('/');
    const numerator = parsePositiveNumber(numeratorValue);
    const denominator = parsePositiveNumber(denominatorValue);
    if (numerator !== null && denominator !== null) {
      return numerator / denominator;
    }
  }

  return parsePositiveNumber(value);
}

async function probeMediaInfo(ffprobePath, inputPath) {
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
    const videoStream = streams.find((stream) => stream.codec_type === 'video');
    const audioStream = streams.find((stream) => stream.codec_type === 'audio');

    return {
      width: parsePositiveInteger(videoStream?.width),
      height: parsePositiveInteger(videoStream?.height),
      frameRate: parseFractionalNumber(videoStream?.avg_frame_rate)
        ?? parseFractionalNumber(videoStream?.r_frame_rate),
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

function getReduceVideoCrf(videoFormat, mediaInfo, mode) {
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

function getReduceVideoScaleFilter(mediaInfo) {
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

function getReduceAudioBitrateKbps(mediaInfo, videoFormat, mode) {
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

function getReduceVideoBitrateKbps(mediaInfo, audioBitrateKbps, mode) {
  if (!mediaInfo?.totalBitrate) {
    return null;
  }

  const sourceTotalBitrateKbps = Math.round(mediaInfo.totalBitrate / 1000);
  const targetRatio = mode === 'fallback' ? 0.62 : 0.78;
  const desiredTotalBitrateKbps = Math.max(350, Math.round(sourceTotalBitrateKbps * targetRatio));
  const desiredVideoBitrateKbps = desiredTotalBitrateKbps - (audioBitrateKbps || 0);

  return desiredVideoBitrateKbps >= 250 ? desiredVideoBitrateKbps : null;
}

function shouldUseFaststart(outputExtension) {
  return outputExtension === 'mp4' || outputExtension === 'm4v' || outputExtension === 'mov';
}

function buildReduceVideoArgs(inputPath, outputPath, normalizedExtension, mediaInfo, mode = 'default') {
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

async function convertVideoWithFallback({
  ffmpegPath,
  ffprobePath,
  file,
  outputPath,
  extension,
  progressCallback,
  cancellationToken,
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

function buildReduceImageArgs(inputPath, outputPath, normalizedExtension) {
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
      'split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg'
    );
  } else {
    args.push('-q:v', '3');
  }

  args.push('-map_metadata', '-1', outputPath);
  return args;
}

async function getFileSizeBytesByPath(filePath) {
  const directory = getDirectoryFromPath(filePath);
  const baseName = getFileNameFromPath(filePath);
  if (!directory) return null;
  try {
    const entries = await sigma.fs.readDir(directory);
    const expectedNameKey = normalizeOutputNameKey(baseName);
    const match = entries.find((entry) => normalizeOutputNameKey(entry.name) === expectedNameKey);
    if (match && typeof match.size === 'number') {
      return match.size;
    }
  } catch (sizeError) {
    console.warn('[Media Converter] Could not read file size:', sizeError);
  }
  return null;
}

function getEntryInputSizeBytes(entry) {
  if (typeof entry.size === 'number' && entry.size >= 0) {
    return entry.size;
  }
  return null;
}

// --- Modal creation ---

function buildSummaryText(videoFiles: ClassifiableEntry[], imageFiles: ClassifiableEntry[]) {
  const hasVideos = videoFiles.length > 0;
  const hasImages = imageFiles.length > 0;

  if (hasVideos && hasImages) {
    const videoPart = videoFiles.length === 1 ? t('oneVideo') : t('nVideos', { n: videoFiles.length });
    const imagePart = imageFiles.length === 1 ? t('oneImage') : t('nImages', { n: imageFiles.length });
    return `${videoPart}, ${imagePart}`;
  }

  const files = hasVideos ? videoFiles : imageFiles;

  if (files.length === 1) {
    return files[0].name;
  }

  const remaining = files.length - 1;
  const moreLabel = hasVideos
    ? (remaining === 1 ? t('andOneMoreVideo') : t('andNMoreVideos', { n: remaining }))
    : (remaining === 1 ? t('andOneMoreImage') : t('andNMoreImages', { n: remaining }));
  return `${files[0].name} ${moreLabel}`;
}

function buildVideoFormatContent(
  videoFormat: string,
  videoCodecMode: string,
  videoFiles: ClassifiableEntry[],
  imageFiles: ClassifiableEntry[],
) {
  const hasImages = imageFiles.length > 0;
  const content: UIElement[] = [];

  if (hasImages) {
    content.push(sigma.ui.text(t('videoFiles', { count: videoFiles.length })));
  }

  content.push(
    sigma.ui.select({
      id: 'videoFormat',
      label: t('outputFormat'),
      options: getVideoOutputFormats(),
      value: videoFormat,
    })
  );

  if (videoFormat === 'gif') {
    content.push(
      sigma.ui.select({
        id: 'videoFramerate',
        label: t('framerate'),
        options: getVideoFramerateOptions(),
        value: 'original',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'gifWidth',
        label: t('gifWidth'),
        options: getGifWidthOptions(),
        value: 'original',
      })
    );
    content.push(
      sigma.ui.checkbox({
        id: 'gifHighQuality',
        label: t('gifHighQuality'),
        checked: true,
      })
    );
  } else {
    content.push(
      sigma.ui.select({
        id: 'videoCodecMode',
        label: t('codecMode'),
        options: getVideoCodecModes(),
        value: videoCodecMode,
      })
    );

    if (videoCodecMode !== 'copy') {
      content.push(
        sigma.ui.select({
          id: 'videoQuality',
          label: t('videoQuality'),
          options: getVideoQualityOptions(),
          value: '18',
        })
      );
      content.push(
        sigma.ui.select({
          id: 'videoFramerate',
          label: t('framerate'),
          options: getVideoFramerateOptions(),
          value: 'original',
        })
      );
      content.push(
        sigma.ui.select({
          id: 'videoResolution',
          label: t('resolution'),
          options: getVideoResolutionOptions(),
          value: 'original',
        })
      );
    }

    content.push(
      sigma.ui.select({
        id: 'videoAudio',
        label: t('audio'),
        options: getVideoAudioOptions(),
        value: 'keep',
      })
    );
  }

  return content;
}

function buildModalContent(
  videoFormat: string,
  videoCodecMode: string,
  videoFiles: ClassifiableEntry[],
  imageFiles: ClassifiableEntry[],
) {
  const hasVideos = videoFiles.length > 0;
  const hasImages = imageFiles.length > 0;
  const content: UIElement[] = [];

  content.push(sigma.ui.text(buildSummaryText(videoFiles, imageFiles)));
  content.push(sigma.ui.separator());

  if (hasVideos) {
    content.push(...buildVideoFormatContent(videoFormat, videoCodecMode, videoFiles, imageFiles));
  }

  if (hasImages) {
    if (hasVideos) {
      content.push(sigma.ui.separator());
      content.push(sigma.ui.text(t('imageFiles', { count: imageFiles.length })));
    }
    content.push(
      sigma.ui.select({
        id: 'imageFormat',
        label: t('outputFormat'),
        options: getImageOutputFormats(),
        value: 'webp',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'imageQuality',
        label: t('quality'),
        options: getImageQualityOptions(),
        value: '90',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'imageResize',
        label: t('resize'),
        options: getImageResizeOptions(),
        value: 'original',
      })
    );
  }

  content.push(sigma.ui.separator());
  content.push(
    sigma.ui.checkbox({
      id: 'includeParams',
      label: t('includeParams'),
      checked: false,
    })
  );

  return content;
}

function createConvertModal(videoFiles: ClassifiableEntry[], imageFiles: ClassifiableEntry[]) {
  const hasVideos = videoFiles.length > 0;
  let currentVideoFormat = 'mp4';
  let currentVideoCodecMode = 'auto';
  const content = buildModalContent(currentVideoFormat, currentVideoCodecMode, videoFiles, imageFiles);

  return new Promise<Record<string, unknown> | null>((resolve) => {
    const modal = sigma.ui.createModal({
      title: t('title'),
      width: 600,
      content,
      buttons: [
        { id: 'convert', label: t('convert'), variant: 'primary', shortcut: { key: 'Enter' } },
      ],
    });

    if (hasVideos) {
      modal.onValueChange((elementId, value) => {
        if (elementId === 'videoFormat') {
          currentVideoFormat = String(value);
          currentVideoCodecMode = 'auto';
          modal.setContent(buildModalContent(currentVideoFormat, currentVideoCodecMode, videoFiles, imageFiles));
        } else if (elementId === 'videoCodecMode') {
          currentVideoCodecMode = String(value);
          modal.setContent(buildModalContent(currentVideoFormat, currentVideoCodecMode, videoFiles, imageFiles));
        }
      });
    }

    modal.onSubmit((values) => {
      resolve(values);
    });

    modal.onClose(() => {
      resolve(null);
    });
  });
}

// --- ffmpeg progress parsing ---

function parseFfmpegProgress(line) {
  const sizeMatch = line.match(/Lsize=\s*([\d.]+\s*\w+)/i) || line.match(/size=\s*([\d.]+\s*\w+)/i);
  const timeMatch = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2}|\d{2}:\d{2}:\d{2})/i);
  const bitrateMatch = line.match(/bitrate=\s*([\d.]+\s*\w+\/s)/i);
  const speedMatch = line.match(/speed=\s*([\d.]+x)/i);
  const frameMatch = line.match(/frame=\s*(\d+)/i);

  if (!timeMatch && !sizeMatch && !frameMatch) {
    return null;
  }

  return {
    size: sizeMatch ? sizeMatch[1].trim() : null,
    time: timeMatch ? timeMatch[1] : null,
    bitrate: bitrateMatch ? bitrateMatch[1].trim() : null,
    speed: speedMatch ? speedMatch[1] : null,
    frame: frameMatch ? Number(frameMatch[1]) : null,
  };
}

function formatProgressMessage(info: { time?: string | null; size?: string | null; speed?: string | null }, fileName: string) {
  const parts: string[] = [];

  if (info.time) {
    parts.push(info.time.split('.')[0]);
  }

  if (info.size) {
    parts.push(info.size);
  }

  if (info.speed) {
    parts.push(info.speed);
  }

  const progressDetail = parts.length > 0 ? parts.join(' \u2022 ') : t('processing');
  return `${fileName}: ${progressDetail}`;
}

// --- File conversion ---

async function convertSingleFile(ffmpegPath, inputPath, ffmpegArgs, progressCallback, cancellationToken) {
  let lastUpdateTime = 0;
  const UPDATE_INTERVAL = 200;
  const fileName = sigma.path.basename(inputPath);

  const commandTask = await sigma.shell.runWithProgress(
    ffmpegPath,
    ffmpegArgs,
    (payload) => {
      const line = String(payload.line || '').trim();
      if (!line) return;

      const now = Date.now();
      if (now - lastUpdateTime < UPDATE_INTERVAL) return;
      lastUpdateTime = now;

      const progressInfo = parseFfmpegProgress(line);
      if (progressInfo && progressCallback) {
        progressCallback(formatProgressMessage(progressInfo, fileName));
      }
    }
  );

  let cancellationRequested = Boolean(cancellationToken && cancellationToken.isCancellationRequested);

  if (cancellationRequested) {
    try {
      await commandTask.cancel();
    } catch (cancelError) {
      console.warn('[Media Converter] Failed to cancel ffmpeg:', cancelError);
    }
  }

  if (cancellationToken) {
    cancellationToken.onCancellationRequested(async () => {
      cancellationRequested = true;
      try {
        await commandTask.cancel();
      } catch (cancelError) {
        console.warn('[Media Converter] Failed to cancel ffmpeg:', cancelError);
      }
    });
  }

  const result = await commandTask.result;
  return {
    ...result,
    cancelled: cancellationRequested,
  };
}

// --- Main command handler ---

async function handleConvertCommand(initialEntries: ClassifiableEntry[] | null) {
  let entries = initialEntries;
  if (!entries || entries.length === 0) {
    const selectedEntries = await sigma.context.getSelectedEntries();
    if (!selectedEntries || selectedEntries.length === 0) {
      sigma.ui.showNotification({
        title: t('extensionTitle'),
        subtitle: t('noFilesSelected'),
        type: 'warning',
      });
      return;
    }
    entries = selectedEntries;
  }

  const { videoFiles, imageFiles, unsupported } = classifyFiles(entries);
  const totalSupported = videoFiles.length + imageFiles.length;

  if (totalSupported === 0) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: t('noSupportedFiles'),
      description: t('supportedFormats') + [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS].join(', '),
      type: 'warning',
    });
    return;
  }

  let ffmpegPath;
  try {
    ffmpegPath = await ensureFfmpegInstalled();
  } catch (installError: unknown) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: installError instanceof Error ? installError.message : t('failedInstallFfmpeg'),
      type: 'error',
    });
    return;
  }

  const modalResult = await createConvertModal(videoFiles, imageFiles);
  if (!modalResult) return;

  const modalValues = modalResult;

  const includeParams = !!modalValues.includeParams;

  const videoOptions = {
    videoFormat: String(modalValues.videoFormat || 'mp4'),
    videoCodecMode: String(modalValues.videoCodecMode || 'auto'),
    videoQuality: String(modalValues.videoQuality || '18'),
    videoFramerate: String(modalValues.videoFramerate || 'original'),
    videoResolution: String(modalValues.videoResolution || 'original'),
    videoAudio: String(modalValues.videoAudio || 'keep'),
    gifWidth: String(modalValues.gifWidth || 'original'),
    gifHighQuality: modalValues.gifHighQuality !== false,
  };

  const imageOptions = {
    imageFormat: String(modalValues.imageFormat || 'webp'),
    imageQuality: String(modalValues.imageQuality || '90'),
    imageResize: String(modalValues.imageResize || 'original'),
  };

  const allFiles = [
    ...videoFiles.map(file => ({ file, type: 'video' })),
    ...imageFiles.map(file => ({ file, type: 'image' })),
  ];

  const existingNamesSets: Record<string, Set<string>> = {};

  for (const { file } of allFiles) {
    const directoryPath = getDirectoryFromPath(file.path);
    if (directoryPath && !existingNamesSets[directoryPath]) {
      existingNamesSets[directoryPath] = await buildExistingNamesSetForDirectory(
        directoryPath,
        entries.filter((entry) => getDirectoryFromPath(entry.path) === directoryPath)
      );
    }
  }

  let successCount = 0;
  let failedCount = 0;
  const failedFiles: string[] = [];
  const isBatch = allFiles.length > 1;

  const progressResult = await sigma.ui.withProgress(
    {
      subtitle: t('converting'),
      location: 'notification',
      cancellable: true,
    },
    async (progress, token) => {
      let wasCancelled = false;

      token.onCancellationRequested(() => {
        wasCancelled = true;
      });

      for (let fileIndex = 0; fileIndex < allFiles.length; fileIndex++) {
        if (token.isCancellationRequested || wasCancelled) {
          break;
        }

        const { file, type } = allFiles[fileIndex];
        const fileName = file.name;
        const fileLabel = isBatch
          ? t('fileNOfTotal', { n: fileIndex + 1, total: allFiles.length }) + '\n' + fileName
          : fileName;

        progress.report({
          description: fileLabel,
          increment: fileIndex === 0 ? 0 : (100 / allFiles.length),
        });

        try {
          const dirPath = getDirectoryFromPath(file.path);
          if (!dirPath) {
            failedCount++;
            failedFiles.push(fileName);
            continue;
          }
          const separator = detectSeparator(file.path);
          const baseName = getFileNameWithoutExtension(file.path);
          const existingNames = existingNamesSets[dirPath] || new Set();

          let outputFormat;
          let paramSuffix = '';
          let ffmpegArgs;

          if (type === 'video') {
            outputFormat = videoOptions.videoFormat;
            if (includeParams) {
              paramSuffix = buildParamSuffix('video', videoOptions);
            }
            const outputFileName = resolveOutputFileName(
              baseName + paramSuffix, outputFormat, existingNames
            );
            const outputPath = `${dirPath}${separator}${outputFileName}`;
            ffmpegArgs = buildVideoArgs(file.path, outputPath, videoOptions);
          } else {
            outputFormat = imageOptions.imageFormat;
            if (includeParams) {
              paramSuffix = buildParamSuffix('image', imageOptions);
            }
            const outputFileName = resolveOutputFileName(
              baseName + paramSuffix, outputFormat, existingNames
            );
            const outputPath = `${dirPath}${separator}${outputFileName}`;
            ffmpegArgs = buildImageArgs(file.path, outputPath, imageOptions);
          }

          const result = await convertSingleFile(
            ffmpegPath,
            file.path,
            ffmpegArgs,
            (ffmpegMessage: string) => {
              const label = isBatch
                ? t('fileNOfTotal', { n: fileIndex + 1, total: allFiles.length }) + '\n' + ffmpegMessage
                : ffmpegMessage;
              progress.report({ description: label, increment: 0 });
            },
            token,
          );

          if (result.cancelled) {
            wasCancelled = true;
            break;
          } else if (result.code === 0) {
            successCount++;
          } else {
            failedCount++;
            failedFiles.push(fileName);
            console.error(`[Media Converter] Failed to convert ${fileName}:`, result.stderr);
          }
        } catch (conversionError) {
          failedCount++;
          failedFiles.push(fileName);
          console.error(`[Media Converter] Error converting ${fileName}:`, conversionError);
        }
      }

      if (!wasCancelled) {
        const doneMessage = failedCount > 0
          ? t('nFailed', { n: failedCount })
          : isBatch
            ? t('nFiles', { n: successCount })
            : allFiles[0].file.name;
        progress.report({
          subtitle: t('converted'),
          description: doneMessage,
          increment: 100,
        });
      }

      return { successCount, failedCount, failedFiles, cancelled: wasCancelled };
    }
  );

  const { cancelled } = progressResult;

  if (cancelled) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: t('convertedBeforeCancel', { count: successCount, total: totalSupported }),
      type: 'info',
    });
  } else if (failedCount > 0) {
    const subtitle = failedCount === allFiles.length
      ? (failedCount === 1 ? t('failedConvert', { name: failedFiles[0] }) : t('failedConvertAll', { count: failedCount }))
      : t('convertedPartial', { success: successCount, total: successCount + failedCount, failed: failedCount });
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle,
      type: 'error',
    });
  }
}

async function handleReduceSizeCommand(initialEntries: ClassifiableEntry[] | null) {
  let entries = initialEntries;
  if (!entries || entries.length === 0) {
    const selectedEntries = await sigma.context.getSelectedEntries();
    if (!selectedEntries || selectedEntries.length === 0) {
      sigma.ui.showNotification({
        title: t('extensionTitle'),
        subtitle: t('noFilesSelected'),
        type: 'warning',
      });
      return;
    }
    entries = selectedEntries;
  }

  const { videoFiles, imageFiles } = classifyFiles(entries);
  const totalSupported = videoFiles.length + imageFiles.length;

  if (totalSupported === 0) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: t('noSupportedFiles'),
      description: t('supportedFormats') + [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS].join(', '),
      type: 'warning',
    });
    return;
  }

  let ffmpegPath;
  let ffprobePath;
  try {
    const toolchain = await ensureFfmpegToolchainAvailable();
    ffmpegPath = toolchain.ffmpegPath;
    ffprobePath = toolchain.ffprobePath;
  } catch (installError: unknown) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: installError instanceof Error ? installError.message : t('failedInstallFfmpeg'),
      type: 'error',
    });
    return;
  }

  const allFiles = [
    ...videoFiles.map((file) => ({ file, type: 'video' })),
    ...imageFiles.map((file) => ({ file, type: 'image' })),
  ];

  const existingNamesSets: Record<string, Set<string>> = {};

  for (const { file } of allFiles) {
    const directoryPath = getDirectoryFromPath(file.path);
    if (directoryPath && !existingNamesSets[directoryPath]) {
      existingNamesSets[directoryPath] = await buildExistingNamesSetForDirectory(
        directoryPath,
        entries.filter((entry) => getDirectoryFromPath(entry.path) === directoryPath)
      );
    }
  }

  let successCount = 0;
  let failedCount = 0;
  const failedFiles: string[] = [];
  let largerThanOriginalCount = 0;
  const isBatch = allFiles.length > 1;

  const progressResult = await sigma.ui.withProgress(
    {
      subtitle: t('reducingSize'),
      location: 'notification',
      cancellable: true,
    },
    async (progress, token) => {
      let wasCancelled = false;

      token.onCancellationRequested(() => {
        wasCancelled = true;
      });

      for (let fileIndex = 0; fileIndex < allFiles.length; fileIndex++) {
        if (token.isCancellationRequested || wasCancelled) {
          break;
        }

        const { file, type } = allFiles[fileIndex];
        const fileName = file.name;
        const fileLabel = isBatch
          ? t('fileNOfTotal', { n: fileIndex + 1, total: allFiles.length }) + '\n' + fileName
          : fileName;

        progress.report({
          description: fileLabel,
          increment: fileIndex === 0 ? 0 : (100 / allFiles.length),
        });

        try {
          const dirPath = getDirectoryFromPath(file.path);
          if (!dirPath) {
            failedCount++;
            failedFiles.push(fileName);
            continue;
          }
          const separator = detectSeparator(file.path);
          const baseName = getFileNameWithoutExtension(file.path);
          const existingNames = existingNamesSets[dirPath] || new Set();
          const extension = (file.extension || getFileExtension(file.path)).toLowerCase().replace(/^\./, '');
          const outputExtension = type === 'video'
            ? getReduceVideoOutputExtension(extension)
            : getReduceImageOutputExtension(extension);

          const outputFileName = resolveOutputFileName(
            `${baseName} - reduced`,
            outputExtension,
            existingNames
          );
          const outputPath = `${dirPath}${separator}${outputFileName}`;

          const progressCallback = (ffmpegMessage: string) => {
            const label = isBatch
              ? t('fileNOfTotal', { n: fileIndex + 1, total: allFiles.length }) + '\n' + ffmpegMessage
              : ffmpegMessage;
            progress.report({ description: label, increment: 0 });
          };

          const resultData = type === 'video'
            ? await convertVideoWithFallback({
              ffmpegPath,
              ffprobePath,
              file,
              outputPath,
              extension,
              progressCallback,
              cancellationToken: token,
            })
            : {
              result: await convertSingleFile(
                ffmpegPath,
                file.path,
                buildReduceImageArgs(file.path, outputPath, extension),
                progressCallback,
                token,
              ),
              inputSizeBytes: getEntryInputSizeBytes(file),
              outputSizeBytes: await getFileSizeBytesByPath(outputPath),
            };

          const { result, inputSizeBytes, outputSizeBytes } = resultData;

          if (result.cancelled) {
            wasCancelled = true;
            break;
          } else if (result.code === 0) {
            successCount++;
            if (
              inputSizeBytes !== null
              && outputSizeBytes !== null
              && outputSizeBytes >= inputSizeBytes
            ) {
              largerThanOriginalCount++;
            }
          } else {
            failedCount++;
            failedFiles.push(fileName);
            console.error(`[Media Converter] Failed to reduce ${fileName}:`, result.stderr);
          }
        } catch (reduceError) {
          failedCount++;
          failedFiles.push(fileName);
          console.error(`[Media Converter] Error reducing ${fileName}:`, reduceError);
        }
      }

      if (!wasCancelled) {
        const doneMessage = failedCount > 0
          ? t('nFailed', { n: failedCount })
          : isBatch
            ? t('nFiles', { n: successCount })
            : allFiles[0].file.name;
        progress.report({
          subtitle: t('reduceSizeDone'),
          description: doneMessage,
          increment: 100,
        });
      }

      return {
        successCount,
        failedCount,
        failedFiles,
        cancelled: wasCancelled,
        largerThanOriginalCount,
      };
    }
  );

  const { cancelled, largerThanOriginalCount: largerCount } = progressResult;

  if (cancelled) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: t('convertedBeforeCancel', { count: successCount, total: totalSupported }),
      type: 'info',
    });
  } else if (failedCount > 0) {
    const subtitle = failedCount === allFiles.length
      ? (failedCount === 1 ? t('failedReduce', { name: failedFiles[0] }) : t('failedReduceAll', { count: failedCount }))
      : t('convertedPartial', { success: successCount, total: successCount + failedCount, failed: failedCount });
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle,
      type: 'error',
    });
  } else if (largerCount > 0) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: !isBatch && largerCount === 1
        ? t('reduceSizeLargerHint', { name: allFiles[0].file.name })
        : t('reduceSizeManyLargerHint', { count: largerCount }),
      type: 'warning',
    });
  }
}

// --- Activation lifecycle ---

let startupActivationPromise: Promise<void> | null = null;

async function handleStartupActivation() {
  if (startupActivationPromise) return startupActivationPromise;
  startupActivationPromise = performStartupActivation();
  return startupActivationPromise;
}

async function performStartupActivation() {
  try {
    await ensureFfmpegToolchainAvailable();
  } catch (error) {
    console.warn('[Media Converter] Failed to resolve FFmpeg paths:', error);
  }
}

async function handleInstallActivation() {
  await ensureFfmpegToolchainAvailable();
}

async function handleUninstallActivation() {
  cachedFfmpegBinaryPath = null;
  cachedFfprobeBinaryPath = null;
}

export async function activate(context: ExtensionActivationContext): Promise<void> {
  await sigma.i18n.mergeFromPath('locales');

  await sigma.commands.registerCommand(
    { id: 'convert', title: t('commandTitle') },
    async () => handleConvertCommand(null)
  );

  await sigma.commands.registerCommand(
    { id: 'reduceSize', title: t('reduceSizeCommandTitle'), icon: 'ImageDown' },
    async () => handleReduceSizeCommand(null)
  );

  await sigma.contextMenu.registerItem(
    {
      id: 'convert',
      title: t('convert'),
      icon: 'RefreshCw',
      group: 'extensions',
      order: 1,
      when: {
        entryType: 'file',
        fileExtensions: [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS],
      },
    },
    async (menuContext) => {
      await handleConvertCommand(menuContext.selectedEntries);
    }
  );

  await sigma.contextMenu.registerItem(
    {
      id: 'reduceSize',
      title: t('reduceSize'),
      icon: 'ImageDown',
      group: 'extensions',
      order: 2,
      when: {
        entryType: 'file',
        fileExtensions: [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS],
      },
    },
    async (menuContext) => {
      await handleReduceSizeCommand(menuContext.selectedEntries);
    }
  );

  if (context.activationEvent === 'onInstall') {
    await handleInstallActivation();
  } else if (context.activationEvent === 'onUninstall') {
    await handleUninstallActivation();
  } else if (
    context.activationEvent === 'onStartup'
    || context.activationEvent === 'onUpdate'
    || context.activationEvent === 'onEnable'
  ) {
    await handleStartupActivation();
  }
}

export async function deactivate(): Promise<void> {
  cachedFfmpegBinaryPath = null;
  cachedFfprobeBinaryPath = null;
  startupActivationPromise = null;
}
