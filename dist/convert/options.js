import { isValidTimeValue, parsePositiveInteger, parsePositiveNumber } from './parse.js';
import { migrateLegacyScaleFields, validateScaleFields } from './scale.js';
const LAST_USED_SETTINGS_KEY = 'lastUsedConvertSettings';
const DEFAULT_OUTPUT_SUBFOLDER_NAME = 'converted';
const VIDEO_PRESET_IDS = ['discordGif', 'webGif', 'archiveMp4', 'socialShare', 'mp4Copy'];
const IMAGE_PRESET_IDS = ['webOptimized'];
const UNIVERSAL_PRESET_IDS = ['lastUsed', 'custom'];
export const BOOLEAN_FORM_FIELDS = new Set([
    'videoLockAspectRatio',
    'imageLockAspectRatio',
    'showAdvanced',
    'gifHighQuality',
    'stripMetadata',
    'includeParams',
]);
const t = sigma.i18n.extensionT;
export function getAvailablePresetIds(hasVideos, hasImages) {
    const presetIds = [...UNIVERSAL_PRESET_IDS];
    if (hasVideos) {
        presetIds.push(...VIDEO_PRESET_IDS);
    }
    if (hasImages) {
        presetIds.push(...IMAGE_PRESET_IDS);
    }
    return presetIds;
}
export function isPresetAvailable(presetId, hasVideos, hasImages) {
    return getAvailablePresetIds(hasVideos, hasImages).includes(presetId);
}
export function getPresetOptions(hasVideos, hasImages) {
    const options = [
        { value: 'lastUsed', label: t('presetLastUsed') },
        { value: 'custom', label: t('presetCustom') },
    ];
    if (hasVideos) {
        options.push({ value: 'discordGif', label: t('presetDiscordGif') }, { value: 'webGif', label: t('presetWebGif') }, { value: 'archiveMp4', label: t('presetArchiveMp4') }, { value: 'socialShare', label: t('presetSocialShare') }, { value: 'mp4Copy', label: t('presetMp4Copy') });
    }
    if (hasImages) {
        options.push({ value: 'webOptimized', label: t('presetWebOptimized') });
    }
    return options;
}
export function sanitizeFormStateForSelection(formState, hasVideos, hasImages) {
    if (isPresetAvailable(formState.preset, hasVideos, hasImages)) {
        return formState;
    }
    return { ...formState, preset: 'lastUsed' };
}
export function createDefaultFormState() {
    return {
        preset: 'lastUsed',
        videoFormat: 'mp4',
        videoCodecMode: 'auto',
        videoQualitySelect: '18',
        videoQualityCustom: '23',
        framerateSelect: 'original',
        framerateCustom: '30',
        videoScaleMode: 'original',
        videoScaleWidth: '640',
        videoScaleHeight: '1080',
        videoScalePercent: '50',
        videoLockAspectRatio: true,
        imageScaleMode: 'original',
        imageScaleWidth: '1280',
        imageScaleHeight: '1080',
        imageScalePercent: '50',
        imageLockAspectRatio: true,
        showAdvanced: false,
        videoAudio: 'keep',
        audioBitrateKbps: '128',
        encoderPreset: 'medium',
        stripMetadata: false,
        gifHighQuality: true,
        gifMaxColorsSelect: '256',
        gifMaxColorsCustom: '128',
        gifDither: 'floyd_steinberg',
        gifLoop: 'infinite',
        gifLoopCount: '3',
        trimStart: '',
        trimDuration: '',
        imageFormat: 'webp',
        imageQualitySelect: '90',
        imageQualityCustom: '85',
        includeParams: false,
    };
}
export function sanitizeOutputSubfolderName(name) {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
        return null;
    }
    if (trimmedName === '.' || trimmedName === '..') {
        return null;
    }
    if (/[\\/:*?"<>|]/.test(trimmedName)) {
        return null;
    }
    return trimmedName;
}
export async function getOutputSubfolderSettings() {
    try {
        const useSubfolder = await sigma.settings.get('defaultOutputSubfolder');
        const configuredName = await sigma.settings.get('outputSubfolderName');
        const subfolderName = sanitizeOutputSubfolderName(String(configuredName ?? ''))
            ?? DEFAULT_OUTPUT_SUBFOLDER_NAME;
        return {
            useSubfolder: useSubfolder === true,
            subfolderName,
        };
    }
    catch (settingsError) {
        console.warn('[Media Converter] Could not read output subfolder settings:', settingsError);
        return {
            useSubfolder: false,
            subfolderName: DEFAULT_OUTPUT_SUBFOLDER_NAME,
        };
    }
}
export function applyModalHint(formState, hint, hasVideos, hasImages) {
    if (!hint) {
        return formState;
    }
    const next = { ...formState };
    if (hint.preset && isPresetAvailable(hint.preset, hasVideos, hasImages)) {
        next.preset = hint.preset;
        return applyPreset(next.preset, next);
    }
    if (hint.videoFormat && hasVideos) {
        next.videoFormat = hint.videoFormat;
    }
    if (hint.videoCodecMode && hasVideos) {
        next.videoCodecMode = hint.videoCodecMode;
    }
    if (hint.imageFormat && hasImages) {
        next.imageFormat = hint.imageFormat;
    }
    if (hint.preset || hint.videoFormat || hint.videoCodecMode || hint.imageFormat) {
        next.preset = 'custom';
    }
    return next;
}
export function applyPreset(presetId, formState) {
    const next = { ...formState, preset: presetId };
    switch (presetId) {
        case 'discordGif':
            next.videoFormat = 'gif';
            next.framerateSelect = '15';
            next.videoScaleMode = 'width';
            next.videoScaleWidth = '320';
            next.gifMaxColorsSelect = '256';
            next.trimDuration = '10';
            next.gifHighQuality = true;
            return next;
        case 'webGif':
            next.videoFormat = 'gif';
            next.framerateSelect = '12';
            next.videoScaleMode = 'width';
            next.videoScaleWidth = '480';
            next.gifMaxColorsSelect = '256';
            next.gifHighQuality = true;
            return next;
        case 'archiveMp4':
            next.videoFormat = 'mp4';
            next.videoCodecMode = 'auto';
            next.videoQualitySelect = '18';
            next.framerateSelect = 'original';
            next.videoScaleMode = 'original';
            next.videoAudio = 'copy';
            return next;
        case 'socialShare':
            next.videoFormat = 'mp4';
            next.videoCodecMode = 'auto';
            next.videoQualitySelect = '23';
            next.videoScaleMode = 'height';
            next.videoScaleHeight = '1080';
            next.framerateSelect = '30';
            return next;
        case 'webOptimized':
            next.imageFormat = 'webp';
            next.imageQualitySelect = '90';
            next.imageScaleMode = 'width';
            next.imageScaleWidth = '1280';
            return next;
        case 'mp4Copy':
            next.videoFormat = 'mp4';
            next.videoCodecMode = 'copy';
            next.videoAudio = 'copy';
            return next;
        case 'lastUsed':
        case 'custom':
            return next;
        default:
            return next;
    }
}
function migrateStoredFormState(stored, defaultState) {
    const legacyScaleFields = migrateLegacyScaleFields(stored);
    const merged = { ...defaultState, ...stored, ...legacyScaleFields };
    return merged;
}
export async function loadLastUsedFormState(defaultState) {
    try {
        const rememberLastUsed = await sigma.settings.get('rememberLastUsed');
        if (rememberLastUsed === false) {
            return defaultState;
        }
        const stored = await sigma.storage.get(LAST_USED_SETTINGS_KEY);
        if (!stored) {
            return defaultState;
        }
        return { ...migrateStoredFormState(stored, defaultState), preset: 'lastUsed' };
    }
    catch (storageError) {
        console.warn('[Media Converter] Could not load last used settings:', storageError);
        return defaultState;
    }
}
export async function saveLastUsedFormState(formState) {
    try {
        const rememberLastUsed = await sigma.settings.get('rememberLastUsed');
        if (rememberLastUsed === false) {
            return;
        }
        const { preset: _preset, ...persistedState } = formState;
        await sigma.storage.set(LAST_USED_SETTINGS_KEY, persistedState);
    }
    catch (storageError) {
        console.warn('[Media Converter] Could not save last used settings:', storageError);
    }
}
export async function applyExtensionDefaults(formState, hasVideos, hasImages) {
    const next = { ...formState };
    try {
        const defaultPreset = await sigma.settings.get('defaultPreset');
        if (defaultPreset
            && defaultPreset !== 'lastUsed'
            && defaultPreset !== 'custom'
            && isPresetAvailable(defaultPreset, hasVideos, hasImages)) {
            return applyPreset(defaultPreset, next);
        }
    }
    catch (settingsError) {
        console.warn('[Media Converter] Could not read extension settings:', settingsError);
    }
    return next;
}
function isConvertFormField(elementId) {
    return elementId in createDefaultFormState();
}
export function mergeFormState(current, elementId, value) {
    if (elementId === 'preset') {
        const presetId = String(value);
        if (presetId === 'custom' || presetId === 'lastUsed') {
            return { ...current, preset: presetId };
        }
        return applyPreset(presetId, { ...current, preset: presetId });
    }
    if (!isConvertFormField(elementId)) {
        return current;
    }
    const fieldValue = BOOLEAN_FORM_FIELDS.has(elementId) ? value === true : String(value);
    const next = { ...current, [elementId]: fieldValue };
    if (elementId === 'videoFormat') {
        next.videoCodecMode = 'auto';
    }
    if (current.preset !== 'custom') {
        next.preset = 'custom';
    }
    return next;
}
function resolveSelectOrCustom(selectValue, customValue) {
    if (selectValue === 'custom') {
        return customValue.trim();
    }
    return selectValue;
}
export function resolveFramerate(framerateSelect, framerateCustom, sourceFrameRate, isGif) {
    if (framerateSelect === 'original') {
        if (sourceFrameRate !== null) {
            const rounded = Math.max(1, Math.round(sourceFrameRate * 100) / 100);
            return String(rounded);
        }
        return isGif ? '15' : 'original';
    }
    if (framerateSelect === 'custom') {
        const customValue = parsePositiveNumber(framerateCustom);
        return customValue !== null ? String(customValue) : (isGif ? '15' : 'original');
    }
    return framerateSelect;
}
export function parseVideoConvertOptions(formState, sourceMediaInfo) {
    const isGif = formState.videoFormat === 'gif';
    return {
        videoFormat: formState.videoFormat,
        videoCodecMode: formState.videoCodecMode,
        videoQuality: resolveSelectOrCustom(formState.videoQualitySelect, formState.videoQualityCustom),
        framerateSelect: formState.framerateSelect,
        framerateCustom: formState.framerateCustom,
        videoFramerate: resolveFramerate(formState.framerateSelect, formState.framerateCustom, sourceMediaInfo?.frameRate ?? null, isGif),
        scaleMode: formState.videoScaleMode,
        scaleWidth: formState.videoScaleWidth.trim(),
        scaleHeight: formState.videoScaleHeight.trim(),
        scalePercent: formState.videoScalePercent.trim(),
        lockAspectRatio: formState.videoLockAspectRatio,
        videoAudio: formState.videoAudio,
        audioBitrateKbps: formState.audioBitrateKbps.trim(),
        encoderPreset: formState.encoderPreset,
        stripMetadata: formState.stripMetadata,
        gifHighQuality: formState.gifHighQuality,
        gifMaxColors: resolveSelectOrCustom(formState.gifMaxColorsSelect, formState.gifMaxColorsCustom),
        gifDither: formState.gifDither,
        gifLoop: formState.gifLoop,
        gifLoopCount: formState.gifLoopCount.trim(),
        trimStart: formState.trimStart.trim(),
        trimDuration: formState.trimDuration.trim(),
    };
}
export function parseImageConvertOptions(formState) {
    return {
        imageFormat: formState.imageFormat,
        imageQuality: resolveSelectOrCustom(formState.imageQualitySelect, formState.imageQualityCustom),
        scaleMode: formState.imageScaleMode,
        scaleWidth: formState.imageScaleWidth.trim(),
        scaleHeight: formState.imageScaleHeight.trim(),
        scalePercent: formState.imageScalePercent.trim(),
        lockAspectRatio: formState.imageLockAspectRatio,
        stripMetadata: formState.stripMetadata,
    };
}
export { parsePositiveInteger } from './parse.js';
export function validateConvertFormState(formState, hasVideos, hasImages) {
    if (hasVideos && formState.videoQualitySelect === 'custom') {
        const crf = parsePositiveInteger(formState.videoQualityCustom);
        if (crf === null || crf > 51) {
            return 'invalidVideoQuality';
        }
    }
    if (hasVideos && formState.framerateSelect === 'custom') {
        const fps = parsePositiveNumber(formState.framerateCustom);
        if (fps === null || fps > 240) {
            return 'invalidFramerate';
        }
    }
    if (hasImages && formState.imageQualitySelect === 'custom') {
        const quality = parsePositiveInteger(formState.imageQualityCustom);
        if (quality === null || quality > 100) {
            return 'invalidImageQuality';
        }
    }
    if (hasVideos) {
        const scaleError = validateScaleFields(formState.videoScaleMode, formState.videoScaleWidth, formState.videoScaleHeight, formState.videoScalePercent);
        if (scaleError) {
            return scaleError;
        }
    }
    if (hasImages) {
        const scaleError = validateScaleFields(formState.imageScaleMode, formState.imageScaleWidth, formState.imageScaleHeight, formState.imageScalePercent);
        if (scaleError) {
            return scaleError;
        }
    }
    if (hasVideos && formState.videoFormat === 'gif' && formState.gifMaxColorsSelect === 'custom') {
        const colors = parsePositiveInteger(formState.gifMaxColorsCustom);
        if (colors === null || colors > 256) {
            return 'invalidGifMaxColors';
        }
    }
    if (hasVideos && formState.videoFormat === 'gif' && formState.gifLoop === 'custom') {
        const loopCount = parsePositiveInteger(formState.gifLoopCount);
        if (loopCount === null) {
            return 'invalidGifLoopCount';
        }
    }
    if (hasVideos && formState.trimStart && !isValidTimeValue(formState.trimStart)) {
        return 'invalidTrimStart';
    }
    if (hasVideos && formState.trimDuration && !isValidTimeValue(formState.trimDuration)) {
        return 'invalidTrimDuration';
    }
    return null;
}
export function buildVideoParamSuffix(options) {
    const parts = [];
    if (options.videoFormat === 'gif') {
        if (options.videoFramerate !== 'original') {
            parts.push(`${options.videoFramerate}fps`);
        }
        if (options.scaleMode === 'width' && options.scaleWidth) {
            parts.push(`${options.scaleWidth}w`);
        }
        else if (options.scaleMode === 'height' && options.scaleHeight) {
            parts.push(`${options.scaleHeight}h`);
        }
        else if (options.scaleMode === 'percent' && options.scalePercent) {
            parts.push(`@${parseFloat(options.scalePercent) / 100}`);
        }
        if (options.gifHighQuality) {
            parts.push('hq');
        }
        if (options.gifMaxColors !== '256') {
            parts.push(`c${options.gifMaxColors}`);
        }
    }
    else if (options.videoCodecMode === 'copy') {
        parts.push('copy');
        if (options.videoAudio === 'remove') {
            parts.push('noaudio');
        }
    }
    else {
        parts.push(`crf${options.videoQuality}`);
        if (options.videoFramerate !== 'original') {
            parts.push(`${options.videoFramerate}fps`);
        }
        if (options.scaleMode === 'height' && options.scaleHeight) {
            parts.push(`${options.scaleHeight}p`);
        }
        else if (options.scaleMode === 'width' && options.scaleWidth) {
            parts.push(`${options.scaleWidth}w`);
        }
        if (options.videoAudio === 'remove') {
            parts.push('noaudio');
        }
    }
    return parts.length > 0 ? '-' + parts.join('-') : '';
}
export function buildImageParamSuffix(options) {
    const parts = [];
    parts.push(`q${options.imageQuality}`);
    if (options.scaleMode === 'percent' && options.scalePercent) {
        parts.push(`@${parseFloat(options.scalePercent) / 100}`);
    }
    else if (options.scaleMode === 'width' && options.scaleWidth) {
        parts.push(`${options.scaleWidth}w`);
    }
    else if (options.scaleMode === 'height' && options.scaleHeight) {
        parts.push(`${options.scaleHeight}h`);
    }
    return parts.length > 0 ? '-' + parts.join('-') : '';
}
export function resolveVideoFramerateForFile(options, sourceFrameRate) {
    const isGif = options.videoFormat === 'gif';
    return {
        ...options,
        videoFramerate: resolveFramerate(options.framerateSelect, options.framerateCustom, sourceFrameRate, isGif),
    };
}
export function formStateFromRecord(values, base) {
    const next = { ...base };
    for (const key of Object.keys(base)) {
        if (values[key] === undefined) {
            continue;
        }
        if (BOOLEAN_FORM_FIELDS.has(key)) {
            next[key] = values[key] !== false;
            continue;
        }
        next[key] = String(values[key]);
    }
    return next;
}
