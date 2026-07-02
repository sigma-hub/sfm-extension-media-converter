const t = sigma.i18n.extensionT;

export function parseFfmpegProgress(line: string) {
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

export function formatProgressMessage(
  info: { time?: string | null; size?: string | null; speed?: string | null },
  fileName: string,
) {
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

type CancellationToken = {
  isCancellationRequested: boolean;
  onCancellationRequested: (callback: () => void) => void;
};

export async function convertSingleFile(
  ffmpegPath: string,
  inputPath: string,
  ffmpegArgs: string[],
  progressCallback: ((message: string) => void) | null,
  cancellationToken: CancellationToken | null,
) {
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
    },
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
