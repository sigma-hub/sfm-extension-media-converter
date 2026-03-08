// @ts-check

/**
 * @typedef {import('@sigma-file-manager/api').ExtensionActivationContext} ExtensionActivationContext
 */

const FFMPEG_BINARY_ID = 'ffmpeg';
let cachedFfmpegBinaryPath = null;
let cachedFfprobeBinaryPath = null;

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'ts', 'mts', 'm4v', '3gp'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'avif', 'gif'];

const VIDEO_OUTPUT_FORMATS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mkv', label: 'MKV' },
  { value: 'webm', label: 'WebM' },
  { value: 'avi', label: 'AVI' },
  { value: 'mov', label: 'MOV' },
  { value: 'gif', label: 'GIF' },
];

const VIDEO_CODEC_MODES = [
  { value: 'auto', label: 'Auto (re-encode)' },
  { value: 'copy', label: 'Copy (fast, no quality loss)' },
];

const VIDEO_QUALITY_OPTIONS = [
  { value: '18', label: 'High (CRF 18)' },
  { value: '23', label: 'Medium (CRF 23)' },
  { value: '28', label: 'Low (CRF 28)' },
  { value: '0', label: 'Lossless (CRF 0)' },
];

const VIDEO_FRAMERATE_OPTIONS = [
  { value: 'original', label: 'Keep original' },
  { value: '60', label: '60 fps' },
  { value: '30', label: '30 fps' },
  { value: '24', label: '24 fps' },
  { value: '15', label: '15 fps' },
  { value: '10', label: '10 fps' },
];

const VIDEO_RESOLUTION_OPTIONS = [
  { value: 'original', label: 'Keep original' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' },
];

const VIDEO_AUDIO_OPTIONS = [
  { value: 'keep', label: 'Keep audio' },
  { value: 'remove', label: 'Remove audio' },
  { value: 'copy', label: 'Copy audio stream' },
];

const GIF_WIDTH_OPTIONS = [
  { value: 'original', label: 'Keep original' },
  { value: '640', label: '640px' },
  { value: '480', label: '480px' },
  { value: '320', label: '320px' },
  { value: '240', label: '240px' },
];

const IMAGE_OUTPUT_FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'bmp', label: 'BMP' },
  { value: 'tiff', label: 'TIFF' },
];

const IMAGE_QUALITY_OPTIONS = [
  { value: '100', label: 'Highest (100)' },
  { value: '90', label: 'High (90)' },
  { value: '75', label: 'Medium (75)' },
  { value: '50', label: 'Low (50)' },
];

const IMAGE_RESIZE_OPTIONS = [
  { value: 'original', label: 'Keep original' },
  { value: '75%', label: '75%' },
  { value: '50%', label: '50%' },
  { value: '25%', label: '25%' },
  { value: '1920', label: '1920px wide' },
  { value: '1280', label: '1280px wide' },
  { value: '800', label: '800px wide' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findLastSeparatorIndex(filePath) {
  const backslashIndex = filePath.lastIndexOf('\\');
  const forwardSlashIndex = filePath.lastIndexOf('/');
  return Math.max(backslashIndex, forwardSlashIndex);
}

function getFileExtension(filePath) {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filePath.substring(lastDot + 1).toLowerCase();
}

function getFileNameWithoutExtension(filePath) {
  const lastSep = findLastSeparatorIndex(filePath);
  const fileName = lastSep === -1 ? filePath : filePath.substring(lastSep + 1);
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return fileName;
  return fileName.substring(0, lastDot);
}

function getDirectoryFromPath(filePath) {
  if (!filePath) return null;
  const lastSep = findLastSeparatorIndex(filePath);
  if (lastSep === -1) return null;
  return filePath.substring(0, lastSep);
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
  return 'ffmpeg';
}

function getFfprobeExecutable() {
  if (sigma.platform.isWindows) {
    return 'bin/ffprobe.exe';
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
  const lastSep = findLastSeparatorIndex(filePath);
  return lastSep === -1 ? filePath : filePath.substring(lastSep + 1);
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

function buildSummaryText(videoFiles, imageFiles) {
  const hasVideos = videoFiles.length > 0;
  const hasImages = imageFiles.length > 0;

  if (hasVideos && hasImages) {
    const videoPart = videoFiles.length === 1 ? '1 video' : `${videoFiles.length} videos`;
    const imagePart = imageFiles.length === 1 ? '1 image' : `${imageFiles.length} images`;
    return `${videoPart}, ${imagePart}`;
  }

  const files = hasVideos ? videoFiles : imageFiles;
  const typeLabel = hasVideos ? 'video' : 'image';

  if (files.length === 1) {
    return files[0].name;
  }

  const remaining = files.length - 1;
  const moreLabel = remaining === 1
    ? `and 1 more ${typeLabel}`
    : `and ${remaining} more ${typeLabel}s`;
  return `${files[0].name} ${moreLabel}`;
}

function buildVideoFormatContent(videoFormat, videoFiles, imageFiles) {
  const hasImages = imageFiles.length > 0;
  const content = [];

  if (hasImages) {
    content.push(sigma.ui.text(`Video files (${videoFiles.length})`));
  }

  content.push(
    sigma.ui.select({
      id: 'videoFormat',
      label: 'Output format',
      options: VIDEO_OUTPUT_FORMATS,
      value: videoFormat,
    })
  );

  if (videoFormat === 'gif') {
    content.push(
      sigma.ui.select({
        id: 'videoFramerate',
        label: 'Framerate',
        options: VIDEO_FRAMERATE_OPTIONS,
        value: 'original',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'gifWidth',
        label: 'GIF width',
        options: GIF_WIDTH_OPTIONS,
        value: 'original',
      })
    );
    content.push(
      sigma.ui.checkbox({
        id: 'gifHighQuality',
        label: 'High quality GIF palette',
        checked: true,
      })
    );
  } else {
    content.push(
      sigma.ui.select({
        id: 'videoCodecMode',
        label: 'Codec mode',
        options: VIDEO_CODEC_MODES,
        value: 'auto',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'videoQuality',
        label: 'Video quality',
        options: VIDEO_QUALITY_OPTIONS,
        value: '23',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'videoFramerate',
        label: 'Framerate',
        options: VIDEO_FRAMERATE_OPTIONS,
        value: 'original',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'videoResolution',
        label: 'Resolution',
        options: VIDEO_RESOLUTION_OPTIONS,
        value: 'original',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'videoAudio',
        label: 'Audio',
        options: VIDEO_AUDIO_OPTIONS,
        value: 'keep',
      })
    );
  }

  return content;
}

function buildModalContent(videoFormat, videoFiles, imageFiles) {
  const hasVideos = videoFiles.length > 0;
  const hasImages = imageFiles.length > 0;
  const content = [];

  content.push(sigma.ui.text(buildSummaryText(videoFiles, imageFiles)));
  content.push(sigma.ui.separator());

  if (hasVideos) {
    content.push(...buildVideoFormatContent(videoFormat, videoFiles, imageFiles));
  }

  if (hasImages) {
    if (hasVideos) {
      content.push(sigma.ui.separator());
      content.push(sigma.ui.text(`Image files (${imageFiles.length})`));
    }
    content.push(
      sigma.ui.select({
        id: 'imageFormat',
        label: 'Output format',
        options: IMAGE_OUTPUT_FORMATS,
        value: 'webp',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'imageQuality',
        label: 'Quality',
        options: IMAGE_QUALITY_OPTIONS,
        value: '90',
      })
    );
    content.push(
      sigma.ui.select({
        id: 'imageResize',
        label: 'Resize',
        options: IMAGE_RESIZE_OPTIONS,
        value: 'original',
      })
    );
  }

  content.push(sigma.ui.separator());
  content.push(
    sigma.ui.checkbox({
      id: 'includeParams',
      label: 'Include parameters in filename (example: photo-q90-@0.75.webp)',
      checked: false,
    })
  );

  return content;
}

function createConvertModal(videoFiles, imageFiles) {
  const hasVideos = videoFiles.length > 0;
  const initialVideoFormat = 'mp4';
  const content = buildModalContent(initialVideoFormat, videoFiles, imageFiles);

  return new Promise((resolve) => {
    const modal = sigma.ui.createModal({
      title: 'Convert',
      width: 600,
      content,
      buttons: [
        { id: 'convert', label: 'Convert', variant: 'primary', shortcut: { key: 'Enter' } },
      ],
    });

    if (hasVideos) {
      modal.onValueChange((elementId, value) => {
        if (elementId === 'videoFormat') {
          const newContent = buildModalContent(String(value), videoFiles, imageFiles);
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

function formatProgressMessage(info, fileName) {
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

  const progressDetail = parts.length > 0 ? parts.join(' \u2022 ') : 'Processing...';
  return `${fileName}: ${progressDetail}`;
}

// --- File conversion ---

async function convertSingleFile(ffmpegPath, inputPath, ffmpegArgs, progressCallback, cancellationToken) {
  let lastUpdateTime = 0;
  const UPDATE_INTERVAL = 200;
  const lastSep = findLastSeparatorIndex(inputPath);
  const fileName = lastSep === -1 ? inputPath : inputPath.substring(lastSep + 1);

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
    } catch {}
  }

  if (cancellationToken) {
    cancellationToken.onCancellationRequested(() => {
      cancellationRequested = true;
      commandTask.cancel().catch(() => {});
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
  if (!entries || entries.length === 0) {
    const selectedEntries = sigma.context.getSelectedEntries();
    if (!selectedEntries || selectedEntries.length === 0) {
      sigma.ui.showNotification({
        title: 'Media Converter',
        subtitle: 'No files selected. Select files to convert.',
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
      title: 'Media Converter',
      subtitle: 'No supported media files in selection.',
      description: 'Supported formats: ' +
        [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS].join(', '),
      type: 'warning',
    });
    return;
  }

  let ffmpegPath;
  try {
    ffmpegPath = await ensureFfmpegInstalled();
  } catch (installError) {
    sigma.ui.showNotification({
      title: 'Media Converter',
      subtitle: installError.message || 'Failed to install FFmpeg',
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
      subtitle: 'Converting',
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
          ? `File ${fileIndex + 1} of ${allFiles.length}\n${fileName}`
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
                ? `File ${fileIndex + 1} of ${allFiles.length}\n${ffmpegMessage}`
                : ffmpegMessage;
              progress.report({ description: label, increment: 0 });
            },
            token
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
          ? `${failedCount} failed`
          : isBatch
            ? `${successCount} files`
            : allFiles[0].file.name;
        progress.report({
          subtitle: 'Converted',
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
      title: 'Media Converter',
      subtitle: `Converted ${successCount} of ${totalSupported} files before cancellation`,
      type: 'info',
    });
  } else if (failedCount > 0) {
    sigma.ui.showNotification({
      title: 'Media Converter',
      subtitle: failedCount === allFiles.length
        ? (failedCount === 1 ? `Failed to convert ${failedFiles[0]}` : `Failed to convert all ${failedCount} files`)
        : `Converted ${successCount} of ${successCount + failedCount} files. ${failedCount} failed.`,
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
  try {
    await ensureFfmpegInstalled();
    await ensureFfprobeAvailable();
  } catch (error) {
    sigma.ui.showNotification({
      title: 'Media Converter',
      subtitle: error.message || 'Failed to set up Media Converter',
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
async function activate(context) {
  sigma.commands.registerCommand(
    { id: 'convert', title: 'Convert selected media files' },
    async () => handleConvertCommand(null)
  );

  sigma.contextMenu.registerItem(
    {
      id: 'convert',
      title: 'Convert',
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

async function deactivate() {}

if (typeof module !== 'undefined') {
  module.exports = { activate, deactivate };
}
