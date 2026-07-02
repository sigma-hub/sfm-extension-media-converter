import { describe, expect, it } from 'vitest';
import { buildImageArgs, buildVideoArgs } from '../ffmpeg.js';
import { applyPreset, createDefaultFormState, validateConvertFormState } from '../options.js';
import { buildReduceVideoArgs } from '../reduce.js';
import { migrateLegacyScaleFields, resolveScaledDimensions, validateScaleFields } from '../scale.js';

describe('applyPreset', () => {
  it('applies mp4 copy preset', () => {
    const result = applyPreset('mp4Copy', createDefaultFormState());
    expect(result.videoFormat).toBe('mp4');
    expect(result.videoCodecMode).toBe('copy');
    expect(result.videoAudio).toBe('copy');
  });

  it('applies web optimized preset', () => {
    const result = applyPreset('webOptimized', createDefaultFormState());
    expect(result.imageFormat).toBe('webp');
    expect(result.imageScaleMode).toBe('width');
    expect(result.imageScaleWidth).toBe('1280');
  });
});

describe('validateConvertFormState', () => {
  it('rejects invalid custom crf', () => {
    const formState = {
      ...createDefaultFormState(),
      videoQualitySelect: 'custom',
      videoQualityCustom: '99',
    };
    expect(validateConvertFormState(formState, true, false)).toBe('invalidVideoQuality');
  });

  it('accepts valid scale width', () => {
    const formState = {
      ...createDefaultFormState(),
      imageScaleMode: 'width',
      imageScaleWidth: '800',
    };
    expect(validateConvertFormState(formState, false, true)).toBeNull();
  });
});

describe('validateScaleFields', () => {
  it('rejects invalid percent', () => {
    expect(validateScaleFields('percent', '', '', '150')).toBe('invalidScalePercent');
  });
});

describe('migrateLegacyScaleFields', () => {
  it('maps legacy gif width to scale mode', () => {
    expect(migrateLegacyScaleFields({ gifWidth: '320' })).toEqual({
      videoScaleMode: 'width',
      videoScaleWidth: '320',
    });
  });

  it('maps legacy image resize percent', () => {
    expect(migrateLegacyScaleFields({ imageResize: '75%' })).toEqual({
      imageScaleMode: 'percent',
      imageScalePercent: '75',
    });
  });
});

describe('resolveScaledDimensions', () => {
  it('scales by width while preserving aspect ratio', () => {
    expect(resolveScaledDimensions('width', '640', '', '', 1920, 1080)).toEqual({
      width: 640,
      height: 360,
    });
  });
});

describe('buildVideoArgs', () => {
  it('builds mp4 copy args', () => {
    const args = buildVideoArgs('/in.mov', '/out.mp4', {
      videoFormat: 'mp4',
      videoCodecMode: 'copy',
      videoQuality: '23',
      framerateSelect: 'original',
      framerateCustom: '30',
      videoFramerate: 'original',
      scaleMode: 'original',
      scaleWidth: '',
      scaleHeight: '',
      scalePercent: '',
      lockAspectRatio: true,
      videoAudio: 'copy',
      audioBitrateKbps: '128',
      encoderPreset: 'medium',
      stripMetadata: false,
      gifHighQuality: true,
      gifMaxColors: '256',
      gifDither: 'floyd_steinberg',
      gifLoop: 'infinite',
      gifLoopCount: '3',
      trimStart: '',
      trimDuration: '',
    });

    expect(args).toContain('-c:v');
    expect(args).toContain('copy');
    expect(args.at(-1)).toBe('/out.mp4');
  });
});

describe('buildReduceVideoArgs', () => {
  it('uses stronger fallback crf for large sources', () => {
    const args = buildReduceVideoArgs('/in.mp4', '/out.mp4', 'mp4', {
      width: 3840,
      height: 2160,
      frameRate: 30,
      durationSeconds: 120,
      videoCodec: 'h264',
      totalBitrate: 20_000_000,
      audioBitrate: 192_000,
      audioChannels: 2,
      hasAudio: true,
    }, 'fallback');

    expect(args).toContain('libx264');
    expect(args).toContain('-crf');
    expect(args).toContain('29');
  });
});

describe('buildImageArgs', () => {
  it('builds webp args with quality', () => {
    const args = buildImageArgs('/in.png', '/out.webp', {
      imageFormat: 'webp',
      imageQuality: '90',
      scaleMode: 'original',
      scaleWidth: '',
      scaleHeight: '',
      scalePercent: '',
      lockAspectRatio: true,
      stripMetadata: true,
    });

    expect(args).toContain('-quality');
    expect(args).toContain('90');
    expect(args).toContain('-map_metadata');
    expect(args).toContain('-1');
  });
});
