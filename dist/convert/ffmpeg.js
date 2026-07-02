import { parsePositiveInteger } from './parse.js';
import { buildScaleFilter } from './scale.js';
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
function appendTrimArgs(args, options) {
    if (options.trimStart) {
        args.push('-ss', options.trimStart);
    }
}
function appendTrimDurationArgs(args, options) {
    if (options.trimDuration) {
        args.push('-t', options.trimDuration);
    }
}
function appendGifLoopArgs(args, options) {
    if (options.gifLoop === 'once') {
        args.push('-loop', '1');
    }
    else if (options.gifLoop === 'custom') {
        const loopCount = parsePositiveInteger(options.gifLoopCount);
        if (loopCount !== null) {
            args.push('-loop', String(loopCount));
        }
    }
    else {
        args.push('-loop', '0');
    }
}
function buildGifPaletteFilter(scaleFilter, options) {
    const maxColors = parsePositiveInteger(options.gifMaxColors) ?? 256;
    const ditherValue = options.gifDither === 'none' ? 'none' : options.gifDither;
    const paletteFilter = `${scaleFilter},split[s0][s1];[s0]palettegen=max_colors=${maxColors}:stats_mode=diff[p];[s1][p]paletteuse=dither=${ditherValue}`;
    return paletteFilter;
}
export function buildVideoArgs(inputPath, outputPath, options) {
    if (options.videoFormat === 'gif') {
        return buildGifArgs(inputPath, outputPath, options);
    }
    const args = ['-y', '-hide_banner', '-loglevel', 'info'];
    appendTrimArgs(args, options);
    args.push('-i', inputPath);
    appendTrimDurationArgs(args, options);
    if (options.stripMetadata) {
        args.push('-map_metadata', '-1');
    }
    if (options.videoCodecMode === 'copy') {
        args.push('-c:v', 'copy');
    }
    else {
        const codec = getVideoCodecForFormat(options.videoFormat);
        args.push('-c:v', codec);
        if (codec === 'libvpx-vp9') {
            args.push('-b:v', '0', '-crf', options.videoQuality || '18');
        }
        else {
            args.push('-crf', options.videoQuality || '18');
            args.push('-preset', options.encoderPreset || 'medium');
            args.push('-pix_fmt', 'yuv420p');
        }
        if (options.videoFramerate && options.videoFramerate !== 'original') {
            args.push('-r', options.videoFramerate);
        }
        const scaleFilter = buildScaleFilter(options.scaleMode, options.scaleWidth, options.scaleHeight, options.scalePercent, options.lockAspectRatio);
        if (scaleFilter) {
            args.push('-vf', scaleFilter);
        }
    }
    if (options.videoAudio === 'remove') {
        args.push('-an');
    }
    else if (options.videoAudio === 'copy' || options.videoCodecMode === 'copy') {
        args.push('-c:a', 'copy');
    }
    else {
        const audioCodec = getAudioCodecForFormat(options.videoFormat);
        args.push('-c:a', audioCodec);
        const audioBitrate = parsePositiveInteger(options.audioBitrateKbps);
        if (audioBitrate !== null) {
            args.push('-b:a', `${audioBitrate}k`);
        }
    }
    args.push(outputPath);
    return args;
}
function buildGifArgs(inputPath, outputPath, options) {
    const fps = options.videoFramerate && options.videoFramerate !== 'original'
        ? options.videoFramerate
        : '15';
    const scaleFilterBase = buildScaleFilter(options.scaleMode, options.scaleWidth, options.scaleHeight, options.scalePercent, options.lockAspectRatio, true);
    const scaleFilter = scaleFilterBase
        ? `fps=${fps},${scaleFilterBase}`
        : `fps=${fps}`;
    const args = ['-y', '-hide_banner', '-loglevel', 'info'];
    appendTrimArgs(args, options);
    args.push('-i', inputPath);
    appendTrimDurationArgs(args, options);
    appendGifLoopArgs(args, options);
    if (options.gifHighQuality !== false) {
        args.push('-filter_complex', buildGifPaletteFilter(scaleFilter, options));
    }
    else {
        args.push('-vf', scaleFilter);
    }
    args.push(outputPath);
    return args;
}
export function buildImageArgs(inputPath, outputPath, options) {
    const args = ['-y', '-hide_banner', '-loglevel', 'info', '-i', inputPath];
    if (options.stripMetadata) {
        args.push('-map_metadata', '-1');
    }
    const scaleFilter = buildScaleFilter(options.scaleMode, options.scaleWidth, options.scaleHeight, options.scalePercent, options.lockAspectRatio);
    if (scaleFilter) {
        args.push('-vf', scaleFilter);
    }
    const outputFormat = options.imageFormat || 'png';
    const quality = Number.parseInt(options.imageQuality || '90', 10);
    if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
        const qscale = Math.max(1, Math.round(31 - (quality / 100) * 30));
        args.push('-q:v', String(qscale));
    }
    else if (outputFormat === 'webp') {
        args.push('-quality', String(quality));
    }
    else if (outputFormat === 'avif') {
        const crf = Math.round(63 - (quality / 100) * 63);
        args.push('-crf', String(crf));
    }
    args.push('-frames:v', '1', '-update', '1', outputPath);
    return args;
}
export { getVideoCodecForFormat, getAudioCodecForFormat };
