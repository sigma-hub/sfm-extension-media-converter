import type { ClassifiableEntry } from './types.js';

const t = sigma.i18n.extensionT;

export type BatchFileItem = {
  file: ClassifiableEntry;
  type: 'video' | 'image';
};

export type BatchProcessOutcome = 'success' | 'failed' | 'cancelled';

export type BatchProgressReporter = {
  report: (update: { subtitle?: string; description?: string; increment?: number }) => void;
};

export type BatchCancellationToken = {
  isCancellationRequested: boolean;
  onCancellationRequested: (callback: () => void) => void;
};

export type BatchProcessContext = {
  file: ClassifiableEntry;
  type: 'video' | 'image';
  fileIndex: number;
  totalFiles: number;
  isBatch: boolean;
  progress: BatchProgressReporter;
  token: BatchCancellationToken;
};

export type BatchJobResult = {
  successCount: number;
  failedCount: number;
  failedFiles: string[];
  cancelled: boolean;
};

export type BatchJobOptions = {
  files: BatchFileItem[];
  processingSubtitle: string;
  doneSubtitle: string;
  processFile: (context: BatchProcessContext) => Promise<BatchProcessOutcome>;
};

function buildFileLabel(fileName: string, fileIndex: number, totalFiles: number, isBatch: boolean) {
  if (!isBatch) {
    return fileName;
  }
  return t('fileNOfTotal', { n: fileIndex + 1, total: totalFiles }) + '\n' + fileName;
}

function buildProgressLabel(message: string, fileIndex: number, totalFiles: number, isBatch: boolean) {
  if (!isBatch) {
    return message;
  }
  return t('fileNOfTotal', { n: fileIndex + 1, total: totalFiles }) + '\n' + message;
}

export async function runMediaBatchJob(options: BatchJobOptions): Promise<BatchJobResult> {
  const { files, processingSubtitle, doneSubtitle, processFile } = options;
  const isBatch = files.length > 1;

  return sigma.ui.withProgress(
    {
      subtitle: processingSubtitle,
      location: 'notification',
      cancellable: true,
    },
    async (progress, token) => {
      let wasCancelled = false;
      let successCount = 0;
      let failedCount = 0;
      const failedFiles: string[] = [];

      token.onCancellationRequested(() => {
        wasCancelled = true;
      });

      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        if (token.isCancellationRequested || wasCancelled) {
          break;
        }

        const { file, type } = files[fileIndex];
        const fileName = file.name;

        progress.report({
          description: buildFileLabel(fileName, fileIndex, files.length, isBatch),
          increment: fileIndex === 0 ? 0 : (100 / files.length),
        });

        try {
          const outcome = await processFile({
            file,
            type,
            fileIndex,
            totalFiles: files.length,
            isBatch,
            progress,
            token,
          });

          if (outcome === 'cancelled') {
            wasCancelled = true;
            break;
          }

          if (outcome === 'success') {
            successCount++;
          } else {
            failedCount++;
            failedFiles.push(fileName);
          }
        } catch (processError) {
          failedCount++;
          failedFiles.push(fileName);
          console.error(`[Media Converter] Error processing ${fileName}:`, processError);
        }
      }

      if (!wasCancelled) {
        const doneMessage = failedCount > 0
          ? t('nFailed', { n: failedCount })
          : isBatch
            ? t('nFiles', { n: successCount })
            : files[0].file.name;
        progress.report({
          subtitle: doneSubtitle,
          description: doneMessage,
          increment: 100,
        });
      }

      return {
        successCount,
        failedCount,
        failedFiles,
        cancelled: wasCancelled,
      };
    },
  );
}

export function reportBatchProgressMessage(context: BatchProcessContext, message: string) {
  context.progress.report({
    description: buildProgressLabel(message, context.fileIndex, context.totalFiles, context.isBatch),
    increment: 0,
  });
}
