// @ts-check

/**
 * @typedef {import('@sigma-file-manager/api').ExtensionActivationContext} ExtensionActivationContext
 */

const FFMPEG_BINARY_ID = 'ffmpeg';
let cachedFfmpegBinaryPath = null;
let cachedFfprobeBinaryPath = null;

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'ts', 'mts', 'm4v', '3gp'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'avif', 'gif'];

const extensionMessages = {
  title: 'Convert',
  convert: 'Convert',
  converting: 'Converting',
  converted: 'Converted',
  processing: 'Processing...',
  noFilesSelected: 'No files selected. Select files to convert.',
  noSupportedFiles: 'No supported media files in selection.',
  supportedFormats: 'Supported formats: ',
  failedInstallFfmpeg: 'Failed to install FFmpeg',
  failedSetup: 'Failed to set up Media Converter',
  convertedBeforeCancel: 'Converted {count} of {total} files before cancellation',
  failedConvert: 'Failed to convert {name}',
  failedConvertAll: 'Failed to convert all {count} files',
  convertedPartial: 'Converted {success} of {total} files. {failed} failed.',
  videoFiles: 'Video files ({count})',
  imageFiles: 'Image files ({count})',
  outputFormat: 'Output format',
  framerate: 'Framerate',
  gifWidth: 'GIF width',
  gifHighQuality: 'High quality GIF palette',
  codecMode: 'Codec mode',
  videoQuality: 'Video quality',
  resolution: 'Resolution',
  audio: 'Audio',
  quality: 'Quality',
  resize: 'Resize',
  includeParams: "Include parameters in filename (example: photo-q90-{'@'}0.75.webp)",
  keepOriginal: 'Keep original',
  autoCopy: 'Auto (re-encode)',
  copy: 'Copy (fast, no quality loss)',
  highCrf18: 'High (CRF 18)',
  mediumCrf23: 'Medium (CRF 23)',
  lowCrf28: 'Low (CRF 28)',
  lossless: 'Lossless (CRF 0)',
  fps60: '60 fps',
  fps30: '30 fps',
  fps24: '24 fps',
  fps15: '15 fps',
  fps10: '10 fps',
  fps10Label: '10 fps',
  keepAudio: 'Keep audio',
  removeAudio: 'Remove audio',
  copyAudio: 'Copy audio stream',
  width640: '640px',
  width480: '480px',
  width320: '320px',
  width240: '240px',
  width1920: '1920px wide',
  width1280: '1280px wide',
  width800: '800px wide',
  scale75: '75%',
  scale50: '50%',
  scale25: '25%',
  highest100: 'Highest (100)',
  high90: 'High (90)',
  medium75: 'Medium (75)',
  low50: 'Low (50)',
  oneVideo: '1 video',
  nVideos: '{n} videos',
  oneImage: '1 image',
  nImages: '{n} images',
  andOneMoreVideo: 'and 1 more video',
  andNMoreVideos: 'and {n} more videos',
  andOneMoreImage: 'and 1 more image',
  andNMoreImages: 'and {n} more images',
  video: 'video',
  image: 'image',
  res1080p: '1080p',
  res720p: '720p',
  res480p: '480p',
  res360p: '360p',
  formatMp4: 'MP4',
  formatMkv: 'MKV',
  formatWebm: 'WebM',
  formatAvi: 'AVI',
  formatMov: 'MOV',
  formatGif: 'GIF',
  formatPng: 'PNG',
  formatJpg: 'JPG',
  formatWebp: 'WebP',
  formatAvif: 'AVIF',
  formatBmp: 'BMP',
  formatTiff: 'TIFF',
  fileNOfTotal: 'File {n} of {total}',
  nFailed: '{n} failed',
  nFiles: '{n} files',
  extensionTitle: 'Media Converter',
  commandTitle: 'Convert selected media files',
  'settings.title': 'Media Converter Settings',
  'settings.description': 'Convert videos and images to other formats using FFmpeg',
  'settings.autoUpdateBinary': 'Auto-update binary',
  'settings.autoUpdateBinaryDescription': 'Automatically check for and download FFmpeg updates on app startup',
};

function formatMessage(template, params) {
  if (!params) {
    return template;
  }

  return String(template).replace(/\{(\w+)\}/g, (fullMatch, paramKey) => {
    return Object.prototype.hasOwnProperty.call(params, paramKey)
      ? String(params[paramKey])
      : fullMatch;
  });
}

function getT() {
  return (key, params) => {
    const translated = sigma.i18n.extensionT(key, params);
    return translated === `extensions.sigma.media-converter.${key}`
      ? formatMessage(extensionMessages[key] ?? key, params)
      : translated;
  };
}

function getVideoOutputFormats(t) {
  return [
    { value: 'mp4', label: t('formatMp4') },
    { value: 'mkv', label: t('formatMkv') },
    { value: 'webm', label: t('formatWebm') },
    { value: 'avi', label: t('formatAvi') },
    { value: 'mov', label: t('formatMov') },
    { value: 'gif', label: t('formatGif') },
  ];
}

function getVideoCodecModes(t) {
  return [
    { value: 'auto', label: t('autoCopy') },
    { value: 'copy', label: t('copy') },
  ];
}

function getVideoQualityOptions(t) {
  return [
    { value: '18', label: t('highCrf18') },
    { value: '23', label: t('mediumCrf23') },
    { value: '28', label: t('lowCrf28') },
    { value: '0', label: t('lossless') },
  ];
}

function getVideoFramerateOptions(t) {
  return [
    { value: 'original', label: t('keepOriginal') },
    { value: '60', label: t('fps60') },
    { value: '30', label: t('fps30') },
    { value: '24', label: t('fps24') },
    { value: '15', label: t('fps15') },
    { value: '10', label: t('fps10') },
  ];
}

function getVideoResolutionOptions(t) {
  return [
    { value: 'original', label: t('keepOriginal') },
    { value: '1080', label: t('res1080p') },
    { value: '720', label: t('res720p') },
    { value: '480', label: t('res480p') },
    { value: '360', label: t('res360p') },
  ];
}

function getVideoAudioOptions(t) {
  return [
    { value: 'keep', label: t('keepAudio') },
    { value: 'remove', label: t('removeAudio') },
    { value: 'copy', label: t('copyAudio') },
  ];
}

function getGifWidthOptions(t) {
  return [
    { value: 'original', label: t('keepOriginal') },
    { value: '640', label: t('width640') },
    { value: '480', label: t('width480') },
    { value: '320', label: t('width320') },
    { value: '240', label: t('width240') },
  ];
}

function getImageOutputFormats(t) {
  return [
    { value: 'png', label: t('formatPng') },
    { value: 'jpg', label: t('formatJpg') },
    { value: 'webp', label: t('formatWebp') },
    { value: 'avif', label: t('formatAvif') },
    { value: 'bmp', label: t('formatBmp') },
    { value: 'tiff', label: t('formatTiff') },
  ];
}

function getImageQualityOptions(t) {
  return [
    { value: '100', label: t('highest100') },
    { value: '90', label: t('high90') },
    { value: '75', label: t('medium75') },
    { value: '50', label: t('low50') },
  ];
}

function getImageResizeOptions(t) {
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

function classifyFiles(entries) {
  const videoFiles = [];
  const imageFiles = [];
  const unsupported = [];

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

function getFfmpegDownloadUrl(platform) {
  const arch = sigma.platform.arch;

  if (platform === 'windows') {
    if (arch === 'arm64') {
      return 'https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-winarm64-gpl.zip';
    }
    if (arch === 'x86') {
      return 'https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win32-gpl.zip';
    }
    return 'https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip';
  }

  if (platform === 'macos') {
    return 'https://evermeet.cx/ffmpeg/getrelease/zip';
  }

  if (platform === 'linux') {
    if (arch === 'arm64') {
      return 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-linuxarm64-gpl.tar.xz';
    }
    return 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-linux64-gpl.tar.xz';
  }

  return null;
}

function getFfmpegExecutable() {
  if (sigma.platform.isWindows) {
    return 'bin/ffmpeg.exe';
  }
  if (sigma.platform.isLinux) {
    return 'bin/ffmpeg';
  }
  return 'ffmpeg';
}

function getFfprobeExecutable() {
  if (sigma.platform.isWindows) {
    return 'bin/ffprobe.exe';
  }
  if (sigma.platform.isLinux) {
    return 'bin/ffprobe';
  }
  return 'ffprobe';
}

async function ensureFfmpegInstalled() {
  if (cachedFfmpegBinaryPath) return cachedFfmpegBinaryPath;

  const downloadUrl = getFfmpegDownloadUrl(sigma.platform.os);
  if (!downloadUrl) {
    throw new Error(`FFmpeg download is not available for ${sigma.platform.os} ${sigma.platform.arch}`);
  }

  const ffmpegPath = await sigma.binary.ensureInstalled(FFMPEG_BINARY_ID, {
    name: 'ffmpeg',
    executable: getFfmpegExecutable(),
    downloadUrl: downloadUrl,
  });

  cachedFfmpegBinaryPath = ffmpegPath;
  cachedFfprobeBinaryPath = ffmpegPath.replace(
    /ffmpeg(\.exe)?$/i,
    `ffprobe${sigma.platform.isWindows ? '.exe' : ''}`
  );

  console.log('[Media Converter] ffmpeg available at:', ffmpegPath);
  console.log('[Media Converter] ffprobe expected at:', cachedFfprobeBinaryPath);

  return ffmpegPath;
}

async function ensureFfprobeAvailable() {
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

// --- Output path logic ---

function detectSeparator(filePath) {
  const lastBackslash = filePath.lastIndexOf('\\');
  const lastForwardSlash = filePath.lastIndexOf('/');
  if (lastBackslash === -1 && lastForwardSlash === -1) return sigma.platform.pathSeparator;
  return lastForwardSlash > lastBackslash ? '/' : '\\';
}

function buildParamSuffix(type, options) {
  const parts = [];

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

function buildExistingNamesSet(entries) {
  const nameSet = new Set();
  for (const entry of entries) {
    const fileName = entry.name || getFileNameFromPath(entry.path);
    nameSet.add(sigma.platform.isWindows ? fileName.toLowerCase() : fileName);
  }
  return nameSet;
}

function resolveOutputFileName(baseName, extension, existingNamesSet) {
  const candidate = `${baseName}.${extension}`;
  const candidateKey = sigma.platform.isWindows ? candidate.toLowerCase() : candidate;

  if (!existingNamesSet.has(candidateKey)) {
    existingNamesSet.add(candidateKey);
    return candidate;
  }

  for (let counter = 1; counter <= 999; counter++) {
    const numbered = `${baseName} (${counter}).${extension}`;
    const numberedKey = sigma.platform.isWindows ? numbered.toLowerCase() : numbered;
    if (!existingNamesSet.has(numberedKey)) {
      existingNamesSet.add(numberedKey);
      return numbered;
    }
  }

  const fallback = `${baseName} (${Date.now()}).${extension}`;
  existingNamesSet.add(sigma.platform.isWindows ? fallback.toLowerCase() : fallback);
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
    args.push('-c', 'copy');
  } else {
    const codec = getVideoCodecForFormat(options.videoFormat);
    args.push('-c:v', codec);

    if (codec === 'libvpx-vp9') {
      args.push('-b:v', '0', '-crf', options.videoQuality || '23');
    } else {
      args.push('-crf', options.videoQuality || '23');
      args.push('-preset', 'medium');
    }

    if (options.videoFramerate && options.videoFramerate !== 'original') {
      args.push('-r', options.videoFramerate);
    }

    if (options.videoResolution && options.videoResolution !== 'original') {
      args.push('-vf', `scale=-2:${options.videoResolution}`);
    }

    if (options.videoAudio === 'remove') {
      args.push('-an');
    } else if (options.videoAudio === 'copy') {
      args.push('-c:a', 'copy');
    } else {
      const audioCodec = getAudioCodecForFormat(options.videoFormat);
      args.push('-c:a', audioCodec);
    }
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

  if (options.gifHighQuality !== false) {
    const filterComplex = `${scaleFilter},split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg`;
    return [
      '-y', '-hide_banner', '-loglevel', 'info',
      '-i', inputPath,
      '-filter_complex', filterComplex,
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
  const filters = [];

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

// --- Modal creation ---

function buildSummaryText(videoFiles, imageFiles, t) {
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

function buildVideoFormatContent(videoFormat, videoFiles, imageFiles, t) {
  const hasImages = imageFiles.length > 0;
  const content = [];

  if (hasImages) {
    content.push(sigma.ui.text(t('videoFiles', { count: videoFiles.length })));
  }

  content.push(
    sigma.ui.select({
      id: 'videoFormat',
      label: t('outputFormat'),
      options: getVideoOutputFormats(t),
      value: videoFormat,
    })
  );

  if (videoFormat === 'gif') {
    content.push(
      sigma.ui.select({
        id: 'videoFramerate',
        label: t('framerate'),
        options: getVideoFramerateOptions(t),
        value: 'original',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'gifWidth',
        label: t('gifWidth'),
        options: getGifWidthOptions(t),
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
        options: getVideoCodecModes(t),
        value: 'auto',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'videoQuality',
        label: t('videoQuality'),
        options: getVideoQualityOptions(t),
        value: '23',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'videoFramerate',
        label: t('framerate'),
        options: getVideoFramerateOptions(t),
        value: 'original',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'videoResolution',
        label: t('resolution'),
        options: getVideoResolutionOptions(t),
        value: 'original',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'videoAudio',
        label: t('audio'),
        options: getVideoAudioOptions(t),
        value: 'keep',
      })
    );
  }

  return content;
}

function buildModalContent(videoFormat, videoFiles, imageFiles, t) {
  const hasVideos = videoFiles.length > 0;
  const hasImages = imageFiles.length > 0;
  const content = [];

  content.push(sigma.ui.text(buildSummaryText(videoFiles, imageFiles, t)));
  content.push(sigma.ui.separator());

  if (hasVideos) {
    content.push(...buildVideoFormatContent(videoFormat, videoFiles, imageFiles, t));
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
        options: getImageOutputFormats(t),
        value: 'webp',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'imageQuality',
        label: t('quality'),
        options: getImageQualityOptions(t),
        value: '90',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'imageResize',
        label: t('resize'),
        options: getImageResizeOptions(t),
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

function createConvertModal(videoFiles, imageFiles) {
  const t = getT();
  const hasVideos = videoFiles.length > 0;
  const initialVideoFormat = 'mp4';
  const content = buildModalContent(initialVideoFormat, videoFiles, imageFiles, t);

  return new Promise((resolve) => {
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
          const newContent = buildModalContent(String(value), videoFiles, imageFiles, t);
          modal.setContent(newContent);
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

function formatProgressMessage(info, fileName, t) {
  const parts = [];

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

async function convertSingleFile(ffmpegPath, inputPath, ffmpegArgs, progressCallback, cancellationToken, t) {
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
        progressCallback(formatProgressMessage(progressInfo, fileName, t));
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

async function handleConvertCommand(entries) {
  const t = getT();

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
  } catch (installError) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: installError.message || t('failedInstallFfmpeg'),
      type: 'error',
    });
    return;
  }

  const modalResult = await createConvertModal(videoFiles, imageFiles);
  if (!modalResult) return;

  const includeParams = !!modalResult.includeParams;

  const videoOptions = {
    videoFormat: String(modalResult.videoFormat || 'mp4'),
    videoCodecMode: String(modalResult.videoCodecMode || 'auto'),
    videoQuality: String(modalResult.videoQuality || '23'),
    videoFramerate: String(modalResult.videoFramerate || 'original'),
    videoResolution: String(modalResult.videoResolution || 'original'),
    videoAudio: String(modalResult.videoAudio || 'keep'),
    gifWidth: String(modalResult.gifWidth || 'original'),
    gifHighQuality: modalResult.gifHighQuality !== false,
  };

  const imageOptions = {
    imageFormat: String(modalResult.imageFormat || 'webp'),
    imageQuality: String(modalResult.imageQuality || '90'),
    imageResize: String(modalResult.imageResize || 'original'),
  };

  const allFiles = [
    ...videoFiles.map(file => ({ file, type: 'video' })),
    ...imageFiles.map(file => ({ file, type: 'image' })),
  ];

  const existingNamesSets = {};

  for (const { file } of allFiles) {
    const dirPath = getDirectoryFromPath(file.path);
    if (dirPath && !existingNamesSets[dirPath]) {
      existingNamesSets[dirPath] = buildExistingNamesSet(
        entries.filter(entry => getDirectoryFromPath(entry.path) === dirPath)
      );
    }
  }

  let successCount = 0;
  let failedCount = 0;
  const failedFiles = [];
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
            (ffmpegMessage) => {
              const label = isBatch
                ? t('fileNOfTotal', { n: fileIndex + 1, total: allFiles.length }) + '\n' + ffmpegMessage
                : ffmpegMessage;
              progress.report({ description: label, increment: 0 });
            },
            token,
            t
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

// --- Activation lifecycle ---

let startupActivationPromise = null;

async function handleStartupActivation() {
  if (startupActivationPromise) return startupActivationPromise;
  startupActivationPromise = performStartupActivation();
  return startupActivationPromise;
}

async function performStartupActivation() {
  const autoUpdate = (await sigma.settings.get('autoUpdateBinary')) !== false;
  if (!autoUpdate) return;

  try {
    await ensureFfmpegInstalled();
  } catch (error) {
    console.warn('[Media Converter] Failed to ensure FFmpeg installed:', error);
  }
}

async function handleInstallActivation() {
  const t = getT();
  try {
    await ensureFfmpegInstalled();
    await ensureFfprobeAvailable();
  } catch (error) {
    sigma.ui.showNotification({
      title: t('extensionTitle'),
      subtitle: error.message || t('failedSetup'),
      type: 'error',
    });
  }
}

async function handleUninstallActivation() {
  try {
    await sigma.binary.remove(FFMPEG_BINARY_ID);
  } catch (error) {
    console.warn('[Media Converter] Failed to remove FFmpeg:', error);
  }
  cachedFfmpegBinaryPath = null;
  cachedFfprobeBinaryPath = null;
}

/**
 * @param {ExtensionActivationContext} context
 */
export async function activate(context) {
  await sigma.i18n.mergeFromPath('locales');

  const t = getT();
  await sigma.commands.registerCommand(
    { id: 'convert', title: t('commandTitle') },
    async () => handleConvertCommand(null)
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

export async function deactivate() {
  cachedFfmpegBinaryPath = null;
  cachedFfprobeBinaryPath = null;
  startupActivationPromise = null;
}
