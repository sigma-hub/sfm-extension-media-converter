import type { ClassifiableEntry } from './types.js';

const FFMPEG_BINARY_ID = 'ffmpeg';
const FFPROBE_BINARY_ID = 'ffprobe';

let cachedFfmpegBinaryPath: string | null = null;
let cachedFfprobeBinaryPath: string | null = null;

export async function ensureFfmpegInstalled() {
  if (cachedFfmpegBinaryPath) return cachedFfmpegBinaryPath;

  const ffmpegPath = await sigma.binary.getPath(FFMPEG_BINARY_ID);
  if (!ffmpegPath) {
    throw new Error(`FFmpeg binary is unavailable for ${sigma.platform.os} ${sigma.platform.arch}`);
  }

  cachedFfmpegBinaryPath = ffmpegPath;

  if (!sigma.platform.isMacos) {
    cachedFfprobeBinaryPath = ffmpegPath.replace(
      /ffmpeg(\.exe)?$/i,
      `ffprobe${sigma.platform.isWindows ? '.exe' : ''}`,
    );
  }

  return ffmpegPath;
}

async function ensureFfprobeInstalledMacos() {
  if (cachedFfprobeBinaryPath) return cachedFfprobeBinaryPath;

  const ffprobePath = await sigma.binary.getPath(FFPROBE_BINARY_ID);
  if (!ffprobePath) {
    throw new Error(`FFprobe binary is unavailable for ${sigma.platform.os} ${sigma.platform.arch}`);
  }

  cachedFfprobeBinaryPath = ffprobePath;
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

export async function ensureFfmpegToolchainAvailable() {
  const ffmpegPath = await ensureFfmpegInstalled();
  const ffprobePath = await ensureFfprobeAvailable();
  return { ffmpegPath, ffprobePath };
}

export function resetFfmpegToolchainCache() {
  cachedFfmpegBinaryPath = null;
  cachedFfprobeBinaryPath = null;
}

let startupActivationPromise: Promise<void> | null = null;

export async function handleStartupActivation() {
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

export async function handleInstallActivation() {
  await ensureFfmpegToolchainAvailable();
}

export function handleUninstallActivation() {
  resetFfmpegToolchainCache();
  startupActivationPromise = null;
}

export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'ts', 'mts', 'm4v', '3gp'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'avif', 'gif'];

export function getFileExtension(filePath: string) {
  const ext = sigma.path.extname(filePath);
  return ext ? ext.substring(1).toLowerCase() : '';
}

export function classifyFiles(entries: ClassifiableEntry[]) {
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

export async function resolveSelectedEntries(initialEntries: ClassifiableEntry[] | null) {
  if (initialEntries && initialEntries.length > 0) {
    return initialEntries;
  }

  const selectedEntries = await sigma.context.getSelectedEntries();
  if (!selectedEntries || selectedEntries.length === 0) {
    return null;
  }

  return selectedEntries;
}
