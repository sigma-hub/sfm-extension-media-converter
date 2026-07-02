import { reportBatchProgressMessage, runMediaBatchJob } from './convert/batch.js';
import { buildImageArgs, buildVideoArgs } from './convert/ffmpeg.js';
import { convertSingleFile } from './convert/ffmpeg-runner.js';
import { createConvertModal } from './convert/modal.js';
import { applyExtensionDefaults, applyModalHint, buildImageParamSuffix, buildVideoParamSuffix, createDefaultFormState, getOutputSubfolderSettings, loadLastUsedFormState, parseImageConvertOptions, parseVideoConvertOptions, resolveVideoFramerateForFile, sanitizeFormStateForSelection, saveLastUsedFormState, validateConvertFormState, } from './convert/options.js';
import { getFileExtension, getFileNameWithoutExtension, preloadExistingNamesSets, prepareOutputLocation, } from './convert/output.js';
import { probeMediaInfo } from './convert/probe.js';
import { convertImageForReduce, convertVideoWithFallback, getReduceOutputExtension, } from './convert/reduce.js';
import { classifyFiles, ensureFfmpegToolchainAvailable, handleInstallActivation, handleStartupActivation, handleUninstallActivation, IMAGE_EXTENSIONS, resetFfmpegToolchainCache, resolveSelectedEntries, VIDEO_EXTENSIONS, } from './convert/toolchain.js';
const t = sigma.i18n.extensionT;
async function prepareInitialFormState(hint, hasVideos, hasImages) {
    let formState = createDefaultFormState();
    formState = await loadLastUsedFormState(formState);
    formState = await applyExtensionDefaults(formState, hasVideos, hasImages);
    formState = applyModalHint(formState, hint, hasVideos, hasImages);
    formState = sanitizeFormStateForSelection(formState, hasVideos, hasImages);
    return formState;
}
function showNoFilesNotification() {
    sigma.ui.showNotification({
        title: t('extensionTitle'),
        subtitle: t('noFilesSelected'),
        type: 'warning',
    });
}
function showNoSupportedFilesNotification() {
    sigma.ui.showNotification({
        title: t('extensionTitle'),
        subtitle: t('noSupportedFiles'),
        description: t('supportedFormats') + [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS].join(', '),
        type: 'warning',
    });
}
async function resolveToolchainOrNotify() {
    try {
        return await ensureFfmpegToolchainAvailable();
    }
    catch (installError) {
        sigma.ui.showNotification({
            title: t('extensionTitle'),
            subtitle: installError instanceof Error ? installError.message : t('failedInstallFfmpeg'),
            type: 'error',
        });
        return null;
    }
}
function showCancelledNotification(successCount, totalSupported) {
    sigma.ui.showNotification({
        title: t('extensionTitle'),
        subtitle: t('convertedBeforeCancel', { count: successCount, total: totalSupported }),
        type: 'info',
    });
}
function showFailureNotification(failedCount, totalFiles, successCount, failedFiles, mode) {
    const subtitle = failedCount === totalFiles
        ? (failedCount === 1
            ? t(mode === 'reduce' ? 'failedReduce' : 'failedConvert', { name: failedFiles[0] })
            : t(mode === 'reduce' ? 'failedReduceAll' : 'failedConvertAll', { count: failedCount }))
        : t('convertedPartial', {
            success: successCount,
            total: successCount + failedCount,
            failed: failedCount,
        });
    sigma.ui.showNotification({
        title: t('extensionTitle'),
        subtitle,
        type: 'error',
    });
}
async function handleConvertCommand(initialEntries, hint) {
    const entries = await resolveSelectedEntries(initialEntries);
    if (!entries) {
        showNoFilesNotification();
        return;
    }
    const { videoFiles, imageFiles } = classifyFiles(entries);
    const totalSupported = videoFiles.length + imageFiles.length;
    if (totalSupported === 0) {
        showNoSupportedFilesNotification();
        return;
    }
    const toolchain = await resolveToolchainOrNotify();
    if (!toolchain)
        return;
    const { ffmpegPath, ffprobePath } = toolchain;
    let sourceMediaInfo = null;
    if (videoFiles.length === 1) {
        sourceMediaInfo = await probeMediaInfo(ffprobePath, videoFiles[0].path);
    }
    const initialFormState = await prepareInitialFormState(hint, videoFiles.length > 0, imageFiles.length > 0);
    const formStateResult = await createConvertModal(videoFiles, imageFiles, initialFormState, sourceMediaInfo);
    if (!formStateResult)
        return;
    const validationError = validateConvertFormState(formStateResult, videoFiles.length > 0, imageFiles.length > 0);
    if (validationError) {
        sigma.ui.showNotification({
            title: t('extensionTitle'),
            subtitle: t(validationError),
            type: 'warning',
        });
        return;
    }
    const rememberLastUsed = await sigma.settings.get('rememberLastUsed');
    if (rememberLastUsed !== false) {
        await saveLastUsedFormState(formStateResult);
    }
    const includeParams = formStateResult.includeParams;
    const outputSubfolderSettings = await getOutputSubfolderSettings();
    const baseVideoOptions = parseVideoConvertOptions(formStateResult, sourceMediaInfo);
    const imageOptions = parseImageConvertOptions(formStateResult);
    const allFiles = [
        ...videoFiles.map((file) => ({ file, type: 'video' })),
        ...imageFiles.map((file) => ({ file, type: 'image' })),
    ];
    const existingNamesSets = await preloadExistingNamesSets(allFiles.map(({ file }) => file), entries);
    const preparedOutputDirectories = new Set();
    const progressResult = await runMediaBatchJob({
        files: allFiles,
        processingSubtitle: t('converting'),
        doneSubtitle: t('converted'),
        processFile: async (context) => {
            const { file, type } = context;
            const baseName = getFileNameWithoutExtension(file.path);
            let outputFormat;
            let paramSuffix = '';
            let ffmpegArgs;
            if (type === 'video') {
                const fileMediaInfo = baseVideoOptions.framerateSelect === 'original'
                    ? await probeMediaInfo(ffprobePath, file.path)
                    : null;
                const videoOptions = resolveVideoFramerateForFile(baseVideoOptions, fileMediaInfo?.frameRate ?? sourceMediaInfo?.frameRate ?? null);
                outputFormat = videoOptions.videoFormat;
                if (includeParams) {
                    paramSuffix = buildVideoParamSuffix(videoOptions);
                }
                const outputLocation = await prepareOutputLocation(file.path, baseName + paramSuffix, outputFormat, existingNamesSets, outputSubfolderSettings, preparedOutputDirectories, entries);
                if (!outputLocation) {
                    return 'failed';
                }
                ffmpegArgs = buildVideoArgs(file.path, outputLocation.outputPath, videoOptions);
            }
            else {
                outputFormat = imageOptions.imageFormat;
                if (includeParams) {
                    paramSuffix = buildImageParamSuffix(imageOptions);
                }
                const outputLocation = await prepareOutputLocation(file.path, baseName + paramSuffix, outputFormat, existingNamesSets, outputSubfolderSettings, preparedOutputDirectories, entries);
                if (!outputLocation) {
                    return 'failed';
                }
                ffmpegArgs = buildImageArgs(file.path, outputLocation.outputPath, imageOptions);
            }
            const result = await convertSingleFile(ffmpegPath, file.path, ffmpegArgs, (ffmpegMessage) => {
                reportBatchProgressMessage(context, ffmpegMessage);
            }, context.token);
            if (result.cancelled) {
                return 'cancelled';
            }
            if (result.code === 0) {
                return 'success';
            }
            console.error(`[Media Converter] Failed to convert ${file.name}:`, result.stderr);
            return 'failed';
        },
    });
    if (progressResult.cancelled) {
        showCancelledNotification(progressResult.successCount, totalSupported);
    }
    else if (progressResult.failedCount > 0) {
        showFailureNotification(progressResult.failedCount, allFiles.length, progressResult.successCount, progressResult.failedFiles, 'convert');
    }
}
async function handleReduceSizeCommand(initialEntries) {
    const entries = await resolveSelectedEntries(initialEntries);
    if (!entries) {
        showNoFilesNotification();
        return;
    }
    const { videoFiles, imageFiles } = classifyFiles(entries);
    const totalSupported = videoFiles.length + imageFiles.length;
    if (totalSupported === 0) {
        showNoSupportedFilesNotification();
        return;
    }
    const toolchain = await resolveToolchainOrNotify();
    if (!toolchain)
        return;
    const { ffmpegPath, ffprobePath } = toolchain;
    const outputSubfolderSettings = await getOutputSubfolderSettings();
    const allFiles = [
        ...videoFiles.map((file) => ({ file, type: 'video' })),
        ...imageFiles.map((file) => ({ file, type: 'image' })),
    ];
    const existingNamesSets = await preloadExistingNamesSets(allFiles.map(({ file }) => file), entries);
    const preparedOutputDirectories = new Set();
    let largerThanOriginalCount = 0;
    const progressResult = await runMediaBatchJob({
        files: allFiles,
        processingSubtitle: t('reducingSize'),
        doneSubtitle: t('reduceSizeDone'),
        processFile: async (context) => {
            const { file, type } = context;
            const baseName = getFileNameWithoutExtension(file.path);
            const extension = (file.extension || getFileExtension(file.path)).toLowerCase().replace(/^\./, '');
            const outputExtension = getReduceOutputExtension(type, extension);
            const outputLocation = await prepareOutputLocation(file.path, `${baseName} - reduced`, outputExtension, existingNamesSets, outputSubfolderSettings, preparedOutputDirectories, entries);
            if (!outputLocation) {
                return 'failed';
            }
            const progressCallback = (ffmpegMessage) => {
                reportBatchProgressMessage(context, ffmpegMessage);
            };
            const resultData = type === 'video'
                ? await convertVideoWithFallback({
                    ffmpegPath,
                    ffprobePath,
                    file,
                    outputPath: outputLocation.outputPath,
                    extension,
                    progressCallback,
                    cancellationToken: context.token,
                })
                : await convertImageForReduce({
                    ffmpegPath,
                    file,
                    outputPath: outputLocation.outputPath,
                    extension,
                    progressCallback,
                    cancellationToken: context.token,
                });
            const { result, inputSizeBytes, outputSizeBytes } = resultData;
            if (result.cancelled) {
                return 'cancelled';
            }
            if (result.code === 0) {
                if (inputSizeBytes !== null
                    && outputSizeBytes !== null
                    && outputSizeBytes >= inputSizeBytes) {
                    largerThanOriginalCount++;
                }
                return 'success';
            }
            console.error(`[Media Converter] Failed to reduce ${file.name}:`, result.stderr);
            return 'failed';
        },
    });
    if (progressResult.cancelled) {
        showCancelledNotification(progressResult.successCount, totalSupported);
    }
    else if (progressResult.failedCount > 0) {
        showFailureNotification(progressResult.failedCount, allFiles.length, progressResult.successCount, progressResult.failedFiles, 'reduce');
    }
    else if (largerThanOriginalCount > 0) {
        const isBatch = allFiles.length > 1;
        sigma.ui.showNotification({
            title: t('extensionTitle'),
            subtitle: !isBatch && largerThanOriginalCount === 1
                ? t('reduceSizeLargerHint', { name: allFiles[0].file.name })
                : t('reduceSizeManyLargerHint', { count: largerThanOriginalCount }),
            type: 'warning',
        });
    }
}
export async function activate(context) {
    await sigma.i18n.mergeFromPath('locales');
    await sigma.commands.registerCommand({ id: 'convert', title: t('commandTitle') }, async () => handleConvertCommand(null));
    await sigma.commands.registerCommand({ id: 'reduceSize', title: t('reduceSizeCommandTitle'), icon: 'ImageDown' }, async () => handleReduceSizeCommand(null));
    await sigma.commands.registerCommand({ id: 'convertToGif', title: t('convertToGifCommandTitle'), icon: 'Image' }, async () => handleConvertCommand(null, { videoFormat: 'gif', preset: 'webGif' }));
    await sigma.commands.registerCommand({ id: 'convertToWebp', title: t('convertToWebpCommandTitle'), icon: 'Image' }, async () => handleConvertCommand(null, { imageFormat: 'webp', preset: 'webOptimized' }));
    await sigma.commands.registerCommand({ id: 'convertToMp4Copy', title: t('convertToMp4CopyCommandTitle'), icon: 'Film' }, async () => handleConvertCommand(null, { preset: 'mp4Copy' }));
    await sigma.contextMenu.registerItem({
        id: 'convert',
        title: t('convert'),
        icon: 'RefreshCw',
        group: 'extensions',
        order: 1,
        when: {
            entryType: 'file',
            fileExtensions: [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS],
        },
    }, async (menuContext) => {
        await handleConvertCommand(menuContext.selectedEntries);
    });
    await sigma.contextMenu.registerItem({
        id: 'convertToGif',
        title: t('convertToGif'),
        icon: 'Image',
        group: 'extensions',
        order: 2,
        when: {
            entryType: 'file',
            fileExtensions: [...VIDEO_EXTENSIONS],
        },
    }, async (menuContext) => {
        await handleConvertCommand(menuContext.selectedEntries, { videoFormat: 'gif', preset: 'webGif' });
    });
    await sigma.contextMenu.registerItem({
        id: 'convertToWebp',
        title: t('convertToWebp'),
        icon: 'Image',
        group: 'extensions',
        order: 3,
        when: {
            entryType: 'file',
            fileExtensions: [...IMAGE_EXTENSIONS],
        },
    }, async (menuContext) => {
        await handleConvertCommand(menuContext.selectedEntries, { imageFormat: 'webp', preset: 'webOptimized' });
    });
    await sigma.contextMenu.registerItem({
        id: 'convertToMp4Copy',
        title: t('convertToMp4Copy'),
        icon: 'Film',
        group: 'extensions',
        order: 4,
        when: {
            entryType: 'file',
            fileExtensions: [...VIDEO_EXTENSIONS],
        },
    }, async (menuContext) => {
        await handleConvertCommand(menuContext.selectedEntries, { preset: 'mp4Copy' });
    });
    await sigma.contextMenu.registerItem({
        id: 'reduceSize',
        title: t('reduceSize'),
        icon: 'ImageDown',
        group: 'extensions',
        order: 5,
        when: {
            entryType: 'file',
            fileExtensions: [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS],
        },
    }, async (menuContext) => {
        await handleReduceSizeCommand(menuContext.selectedEntries);
    });
    if (context.activationEvent === 'onInstall') {
        await handleInstallActivation();
    }
    else if (context.activationEvent === 'onUninstall') {
        handleUninstallActivation();
    }
    else if (context.activationEvent === 'onStartup'
        || context.activationEvent === 'onUpdate'
        || context.activationEvent === 'onEnable') {
        await handleStartupActivation();
    }
}
export async function deactivate() {
    resetFfmpegToolchainCache();
}
export { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS };
