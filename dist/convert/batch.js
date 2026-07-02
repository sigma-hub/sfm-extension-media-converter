const t = sigma.i18n.extensionT;
function buildFileLabel(fileName, fileIndex, totalFiles, isBatch) {
    if (!isBatch) {
        return fileName;
    }
    return t('fileNOfTotal', { n: fileIndex + 1, total: totalFiles }) + '\n' + fileName;
}
function buildProgressLabel(message, fileIndex, totalFiles, isBatch) {
    if (!isBatch) {
        return message;
    }
    return t('fileNOfTotal', { n: fileIndex + 1, total: totalFiles }) + '\n' + message;
}
export async function runMediaBatchJob(options) {
    const { files, processingSubtitle, doneSubtitle, processFile } = options;
    const isBatch = files.length > 1;
    return sigma.ui.withProgress({
        subtitle: processingSubtitle,
        location: 'notification',
        cancellable: true,
    }, async (progress, token) => {
        let wasCancelled = false;
        let successCount = 0;
        let failedCount = 0;
        const failedFiles = [];
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
                }
                else {
                    failedCount++;
                    failedFiles.push(fileName);
                }
            }
            catch (processError) {
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
    });
}
export function reportBatchProgressMessage(context, message) {
    context.progress.report({
        description: buildProgressLabel(message, context.fileIndex, context.totalFiles, context.isBatch),
        increment: 0,
    });
}
