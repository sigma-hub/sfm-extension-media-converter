import { estimateGifOutputBytes, formatByteSizeLabel, formatMediaInfoSummary, resolveOutputDimensions, } from './probe.js';
import { mergeFormState, getPresetOptions, sanitizeFormStateForSelection, createDefaultFormState, loadLastUsedFormState, formStateFromRecord } from './options.js';
const t = sigma.i18n.extensionT;
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
        { value: 'custom', label: t('customValue') },
    ];
}
function getFramerateOptions(includeOriginal) {
    const options = includeOriginal
        ? [{ value: 'original', label: t('keepOriginalFps') }]
        : [{ value: 'original', label: t('keepOriginalFpsGif') }];
    return [
        ...options,
        { value: '60', label: t('fps60') },
        { value: '30', label: t('fps30') },
        { value: '24', label: t('fps24') },
        { value: '15', label: t('fps15') },
        { value: '12', label: t('fps12') },
        { value: '10', label: t('fps10') },
        { value: 'custom', label: t('customValue') },
    ];
}
function getScaleModeOptions() {
    return [
        { value: 'original', label: t('keepOriginal') },
        { value: 'width', label: t('scaleModeWidth') },
        { value: 'height', label: t('scaleModeHeight') },
        { value: 'longestEdge', label: t('scaleModeLongestEdge') },
        { value: 'exact', label: t('scaleModeExact') },
        { value: 'percent', label: t('scaleModePercent') },
    ];
}
function getVideoAudioOptions() {
    return [
        { value: 'keep', label: t('keepAudio') },
        { value: 'remove', label: t('removeAudio') },
        { value: 'copy', label: t('copyAudio') },
    ];
}
function getEncoderPresetOptions() {
    return [
        { value: 'ultrafast', label: t('encoderUltrafast') },
        { value: 'veryfast', label: t('encoderVeryfast') },
        { value: 'fast', label: t('encoderFast') },
        { value: 'medium', label: t('encoderMedium') },
        { value: 'slow', label: t('encoderSlow') },
        { value: 'veryslow', label: t('encoderVeryslow') },
    ];
}
function getGifMaxColorsOptions() {
    return [
        { value: '256', label: t('gifColors256') },
        { value: '128', label: t('gifColors128') },
        { value: '64', label: t('gifColors64') },
        { value: 'custom', label: t('customValue') },
    ];
}
function getGifDitherOptions() {
    return [
        { value: 'floyd_steinberg', label: t('gifDitherFloyd') },
        { value: 'bayer', label: t('gifDitherBayer') },
        { value: 'none', label: t('gifDitherNone') },
    ];
}
function getGifLoopOptions() {
    return [
        { value: 'infinite', label: t('gifLoopInfinite') },
        { value: 'once', label: t('gifLoopOnce') },
        { value: 'custom', label: t('customValue') },
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
        { value: 'custom', label: t('customValue') },
    ];
}
function buildSummaryText(videoFiles, imageFiles) {
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
function buildScaleInputs(scaleMode, scaleWidth, scaleHeight, scalePercent, lockAspectRatio, fieldPrefix) {
    const elements = [];
    const widthId = fieldPrefix === 'video' ? 'videoScaleWidth' : 'imageScaleWidth';
    const heightId = fieldPrefix === 'video' ? 'videoScaleHeight' : 'imageScaleHeight';
    const percentId = fieldPrefix === 'video' ? 'videoScalePercent' : 'imageScalePercent';
    const lockId = fieldPrefix === 'video' ? 'videoLockAspectRatio' : 'imageLockAspectRatio';
    if (scaleMode === 'width' || scaleMode === 'longestEdge') {
        elements.push(sigma.ui.input({
            id: widthId,
            label: scaleMode === 'longestEdge' ? t('longestEdgePx') : t('widthPx'),
            placeholder: '640',
            value: scaleWidth,
        }));
    }
    if (scaleMode === 'height') {
        elements.push(sigma.ui.input({
            id: heightId,
            label: t('heightPx'),
            placeholder: '1080',
            value: scaleHeight,
        }));
    }
    if (scaleMode === 'exact') {
        elements.push(sigma.ui.input({
            id: widthId,
            label: t('widthPx'),
            placeholder: '1920',
            value: scaleWidth,
        }), sigma.ui.input({
            id: heightId,
            label: t('heightPx'),
            placeholder: '1080',
            value: scaleHeight,
        }), sigma.ui.checkbox({
            id: lockId,
            label: t('lockAspectRatio'),
            checked: lockAspectRatio,
        }));
    }
    if (scaleMode === 'percent') {
        elements.push(sigma.ui.input({
            id: percentId,
            label: t('scalePercentLabel'),
            placeholder: '50',
            value: scalePercent,
        }));
    }
    return elements;
}
function buildGifEstimateAlert(formState, mediaInfo) {
    if (formState.videoFormat !== 'gif' || !mediaInfo) {
        return null;
    }
    const fpsValue = formState.framerateSelect === 'custom'
        ? Number.parseFloat(formState.framerateCustom)
        : formState.framerateSelect === 'original'
            ? (mediaInfo.frameRate ?? 15)
            : Number.parseFloat(formState.framerateSelect);
    const durationSeconds = formState.trimDuration
        ? Number.parseFloat(formState.trimDuration) || mediaInfo.durationSeconds || 10
        : mediaInfo.durationSeconds || 10;
    const dimensions = resolveOutputDimensions(formState.videoScaleMode, formState.videoScaleWidth, formState.videoScaleHeight, formState.videoScalePercent, mediaInfo.width, mediaInfo.height);
    const estimatedBytes = estimateGifOutputBytes(dimensions.width, dimensions.height, Number.isFinite(fpsValue) ? fpsValue : 15, durationSeconds);
    if (estimatedBytes < 20 * 1024 * 1024) {
        return null;
    }
    return sigma.ui.alert({
        title: t('gifSizeWarningTitle'),
        description: t('gifSizeWarningDescription', {
            size: formatByteSizeLabel(estimatedBytes),
        }),
        tone: 'warning',
    });
}
function buildVideoSection(formState, videoFiles, imageFiles, mediaInfo) {
    const hasImages = imageFiles.length > 0;
    const content = [];
    const isGif = formState.videoFormat === 'gif';
    if (hasImages) {
        content.push(sigma.ui.text(t('videoFiles', { count: videoFiles.length })));
    }
    content.push(sigma.ui.select({
        id: 'videoFormat',
        label: t('outputFormat'),
        options: getVideoOutputFormats(),
        value: formState.videoFormat,
    }), sigma.ui.select({
        id: 'framerateSelect',
        label: t('framerate'),
        options: getFramerateOptions(!isGif),
        value: formState.framerateSelect,
    }));
    if (formState.framerateSelect === 'custom') {
        content.push(sigma.ui.input({
            id: 'framerateCustom',
            label: t('customFramerate'),
            placeholder: '30',
            value: formState.framerateCustom,
        }));
    }
    content.push(sigma.ui.select({
        id: 'videoScaleMode',
        label: t('dimensions'),
        options: getScaleModeOptions(),
        value: formState.videoScaleMode,
    }));
    content.push(...buildScaleInputs(formState.videoScaleMode, formState.videoScaleWidth, formState.videoScaleHeight, formState.videoScalePercent, formState.videoLockAspectRatio, 'video'));
    if (isGif) {
        content.push(sigma.ui.checkbox({
            id: 'gifHighQuality',
            label: t('gifHighQuality'),
            checked: formState.gifHighQuality,
        }));
    }
    else {
        content.push(sigma.ui.select({
            id: 'videoCodecMode',
            label: t('codecMode'),
            options: getVideoCodecModes(),
            value: formState.videoCodecMode,
        }));
        if (formState.videoCodecMode !== 'copy') {
            content.push(sigma.ui.select({
                id: 'videoQualitySelect',
                label: t('videoQuality'),
                options: getVideoQualityOptions(),
                value: formState.videoQualitySelect,
            }));
            if (formState.videoQualitySelect === 'custom') {
                content.push(sigma.ui.input({
                    id: 'videoQualityCustom',
                    label: t('customCrf'),
                    placeholder: '23',
                    value: formState.videoQualityCustom,
                }));
            }
        }
        content.push(sigma.ui.select({
            id: 'videoAudio',
            label: t('audio'),
            options: getVideoAudioOptions(),
            value: formState.videoAudio,
        }));
    }
    if (isGif) {
        const estimateAlert = buildGifEstimateAlert(formState, mediaInfo);
        if (estimateAlert) {
            content.push(estimateAlert);
        }
    }
    return content;
}
function buildVideoAdvancedSection(formState) {
    const content = [];
    const isGif = formState.videoFormat === 'gif';
    content.push(sigma.ui.text(t('sectionTiming')));
    content.push(sigma.ui.input({
        id: 'trimStart',
        label: t('trimStart'),
        placeholder: t('trimStartPlaceholder'),
        value: formState.trimStart,
    }), sigma.ui.input({
        id: 'trimDuration',
        label: t('trimDuration'),
        placeholder: t('trimDurationPlaceholder'),
        value: formState.trimDuration,
    }));
    if (isGif) {
        content.push(sigma.ui.text(t('sectionGifAdvanced')));
        content.push(sigma.ui.select({
            id: 'gifMaxColorsSelect',
            label: t('gifMaxColors'),
            options: getGifMaxColorsOptions(),
            value: formState.gifMaxColorsSelect,
        }));
        if (formState.gifMaxColorsSelect === 'custom') {
            content.push(sigma.ui.input({
                id: 'gifMaxColorsCustom',
                label: t('customMaxColors'),
                placeholder: '128',
                value: formState.gifMaxColorsCustom,
            }));
        }
        content.push(sigma.ui.select({
            id: 'gifDither',
            label: t('gifDither'),
            options: getGifDitherOptions(),
            value: formState.gifDither,
        }), sigma.ui.select({
            id: 'gifLoop',
            label: t('gifLoop'),
            options: getGifLoopOptions(),
            value: formState.gifLoop,
        }));
        if (formState.gifLoop === 'custom') {
            content.push(sigma.ui.input({
                id: 'gifLoopCount',
                label: t('gifLoopCount'),
                placeholder: '3',
                value: formState.gifLoopCount,
            }));
        }
    }
    else if (formState.videoCodecMode !== 'copy') {
        content.push(sigma.ui.text(t('sectionVideoAdvanced')));
        content.push(sigma.ui.select({
            id: 'encoderPreset',
            label: t('encoderPreset'),
            options: getEncoderPresetOptions(),
            value: formState.encoderPreset,
        }), sigma.ui.input({
            id: 'audioBitrateKbps',
            label: t('audioBitrateKbps'),
            placeholder: '128',
            value: formState.audioBitrateKbps,
        }));
    }
    return content;
}
function buildImageSection(formState, imageFiles, hasVideos) {
    const content = [];
    if (hasVideos) {
        content.push(sigma.ui.text(t('imageFiles', { count: imageFiles.length })));
    }
    content.push(sigma.ui.select({
        id: 'imageFormat',
        label: t('outputFormat'),
        options: getImageOutputFormats(),
        value: formState.imageFormat,
    }), sigma.ui.select({
        id: 'imageQualitySelect',
        label: t('quality'),
        options: getImageQualityOptions(),
        value: formState.imageQualitySelect,
    }));
    if (formState.imageQualitySelect === 'custom') {
        content.push(sigma.ui.input({
            id: 'imageQualityCustom',
            label: t('customQuality'),
            placeholder: '85',
            value: formState.imageQualityCustom,
        }));
    }
    content.push(sigma.ui.select({
        id: 'imageScaleMode',
        label: t('resize'),
        options: getScaleModeOptions(),
        value: formState.imageScaleMode,
    }));
    content.push(...buildScaleInputs(formState.imageScaleMode, formState.imageScaleWidth, formState.imageScaleHeight, formState.imageScalePercent, formState.imageLockAspectRatio, 'image'));
    return content;
}
export function buildModalContent(formState, videoFiles, imageFiles, mediaInfo) {
    const hasVideos = videoFiles.length > 0;
    const hasImages = imageFiles.length > 0;
    const content = [];
    content.push(sigma.ui.text(buildSummaryText(videoFiles, imageFiles)));
    if (mediaInfo && videoFiles.length === 1) {
        content.push(sigma.ui.text(t('sourceInfo', {
            info: formatMediaInfoSummary(mediaInfo, t),
        })));
    }
    else if (videoFiles.length > 1) {
        content.push(sigma.ui.text(t('batchVideoHint')));
    }
    content.push(sigma.ui.select({
        id: 'preset',
        label: t('preset'),
        options: getPresetOptions(hasVideos, hasImages),
        value: sanitizeFormStateForSelection(formState, hasVideos, hasImages).preset,
    }));
    content.push(sigma.ui.separator());
    if (hasVideos || hasImages) {
        content.push(sigma.ui.checkbox({
            id: 'showAdvanced',
            label: t('showAdvancedOptions'),
            checked: formState.showAdvanced,
        }));
    }
    if (hasVideos) {
        content.push(...buildVideoSection(formState, videoFiles, imageFiles, mediaInfo));
        if (formState.showAdvanced) {
            content.push(...buildVideoAdvancedSection(formState));
        }
    }
    if (hasImages) {
        if (hasVideos) {
            content.push(sigma.ui.separator());
        }
        content.push(...buildImageSection(formState, imageFiles, hasVideos));
    }
    if (formState.showAdvanced) {
        content.push(sigma.ui.checkbox({
            id: 'stripMetadata',
            label: t('stripMetadata'),
            checked: formState.stripMetadata,
        }));
    }
    content.push(sigma.ui.separator());
    content.push(sigma.ui.checkbox({
        id: 'includeParams',
        label: t('includeParams'),
        checked: formState.includeParams,
    }));
    return content;
}
function getModalStructureKey(formState, hasVideos, hasImages) {
    const isGif = hasVideos && formState.videoFormat === 'gif';
    const showVideoEncodingOptions = hasVideos && !isGif;
    const showVideoAdvanced = hasVideos && formState.showAdvanced;
    return JSON.stringify({
        hasVideos,
        hasImages,
        videoFormat: hasVideos ? formState.videoFormat : null,
        videoCodecMode: showVideoEncodingOptions ? formState.videoCodecMode : null,
        framerateSelect: hasVideos ? formState.framerateSelect : null,
        videoQualitySelect: showVideoEncodingOptions && formState.videoCodecMode !== 'copy'
            ? formState.videoQualitySelect
            : null,
        videoScaleMode: hasVideos ? formState.videoScaleMode : null,
        showAdvanced: formState.showAdvanced,
        gifMaxColorsSelect: isGif && showVideoAdvanced ? formState.gifMaxColorsSelect : null,
        gifLoop: isGif && showVideoAdvanced ? formState.gifLoop : null,
        showVideoAdvancedEncoding: showVideoAdvanced && showVideoEncodingOptions && formState.videoCodecMode !== 'copy',
        imageQualitySelect: hasImages ? formState.imageQualitySelect : null,
        imageScaleMode: hasImages ? formState.imageScaleMode : null,
        gifEstimate: isGif
            ? [
                formState.framerateSelect,
                formState.videoScaleMode,
                formState.trimDuration,
            ]
            : null,
    });
}
function shouldRebuildModalContent(previousFormState, nextFormState, hasVideos, hasImages) {
    return getModalStructureKey(previousFormState, hasVideos, hasImages)
        !== getModalStructureKey(nextFormState, hasVideos, hasImages);
}
export function createConvertModal(videoFiles, imageFiles, initialFormState, mediaInfo) {
    const hasVideos = videoFiles.length > 0;
    const hasImages = imageFiles.length > 0;
    let formState = sanitizeFormStateForSelection(initialFormState, hasVideos, hasImages);
    return new Promise((resolve) => {
        const modal = sigma.ui.createModal({
            title: t('title'),
            width: 640,
            content: buildModalContent(formState, videoFiles, imageFiles, mediaInfo),
            buttons: [
                { id: 'convert', label: t('convert'), variant: 'primary', shortcut: { key: 'Enter' } },
            ],
        });
        const rebuildContent = () => {
            modal.setContent(buildModalContent(formState, videoFiles, imageFiles, mediaInfo));
        };
        modal.onValueChange(async (elementId, value) => {
            if (elementId === 'preset' && value === 'lastUsed') {
                formState = sanitizeFormStateForSelection(await loadLastUsedFormState(createDefaultFormState()), hasVideos, hasImages);
                rebuildContent();
                return;
            }
            const previousFormState = formState;
            formState = mergeFormState(formState, elementId, value);
            if (shouldRebuildModalContent(previousFormState, formState, hasVideos, hasImages)) {
                rebuildContent();
            }
        });
        modal.onSubmit((values) => {
            formState = formStateFromRecord(values, formState);
            resolve(formState);
        });
        modal.onClose(() => {
            resolve(null);
        });
    });
}
