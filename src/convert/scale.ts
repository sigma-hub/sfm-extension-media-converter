import { parsePositiveInteger, parsePositiveNumber } from './parse.js';
import type { ScaleMode } from './types.js';

export type ScaledDimensions = {
  width: number;
  height: number;
};

export function resolveScaledDimensions(
  scaleMode: ScaleMode | string,
  scaleWidth: string,
  scaleHeight: string,
  scalePercent: string,
  sourceWidth: number | null,
  sourceHeight: number | null,
): ScaledDimensions {
  const fallbackWidth = sourceWidth ?? 640;
  const fallbackHeight = sourceHeight ?? 360;

  if (scaleMode === 'original') {
    return { width: fallbackWidth, height: fallbackHeight };
  }

  if (scaleMode === 'width') {
    const width = parsePositiveInteger(scaleWidth) ?? fallbackWidth;
    return {
      width,
      height: Math.round(fallbackHeight * (width / fallbackWidth)),
    };
  }

  if (scaleMode === 'height') {
    const height = parsePositiveInteger(scaleHeight) ?? fallbackHeight;
    return {
      width: Math.round(fallbackWidth * (height / fallbackHeight)),
      height,
    };
  }

  if (scaleMode === 'longestEdge') {
    const edge = parsePositiveInteger(scaleWidth) ?? Math.max(fallbackWidth, fallbackHeight);
    if (fallbackWidth >= fallbackHeight) {
      return { width: edge, height: Math.round(fallbackHeight * (edge / fallbackWidth)) };
    }
    return { width: Math.round(fallbackWidth * (edge / fallbackHeight)), height: edge };
  }

  if (scaleMode === 'exact') {
    return {
      width: parsePositiveInteger(scaleWidth) ?? fallbackWidth,
      height: parsePositiveInteger(scaleHeight) ?? fallbackHeight,
    };
  }

  if (scaleMode === 'percent') {
    const normalized = String(scalePercent).replace('%', '').trim();
    const percent = Number.parseFloat(normalized);
    const factor = Number.isFinite(percent) && percent > 0 ? percent / 100 : 1;
    return {
      width: Math.round(fallbackWidth * factor),
      height: Math.round(fallbackHeight * factor),
    };
  }

  return { width: fallbackWidth, height: fallbackHeight };
}

function parsePercentFactor(scalePercent: string) {
  const normalized = String(scalePercent).replace('%', '').trim();
  const parsedValue = Number.parseFloat(normalized);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0 || parsedValue > 100) {
    return null;
  }
  return parsedValue / 100;
}

function buildScaleFilterFromDimensions(width: number, height: number, useLanczos: boolean) {
  const flagsSuffix = useLanczos ? ':flags=lanczos' : '';
  return `scale=${width}:${height}${flagsSuffix}`;
}

export function buildScaleFilter(
  scaleMode: ScaleMode,
  scaleWidth: string,
  scaleHeight: string,
  scalePercent: string,
  lockAspectRatio: boolean,
  useLanczos = false,
  sourceWidth: number | null = null,
  sourceHeight: number | null = null,
): string | null {
  const flagsSuffix = useLanczos ? ':flags=lanczos' : '';

  if (scaleMode === 'original') {
    return null;
  }

  if (sourceWidth !== null && sourceHeight !== null) {
    if (scaleMode === 'exact' && !lockAspectRatio) {
      const width = parsePositiveInteger(scaleWidth) ?? sourceWidth;
      const height = parsePositiveInteger(scaleHeight) ?? sourceHeight;
      return buildScaleFilterFromDimensions(width, height, useLanczos);
    }

    const scaled = resolveScaledDimensions(
      scaleMode,
      scaleWidth,
      scaleHeight,
      scalePercent,
      sourceWidth,
      sourceHeight,
    );
    return buildScaleFilterFromDimensions(scaled.width, scaled.height, useLanczos);
  }

  if (scaleMode === 'percent') {
    const scaleFactor = parsePercentFactor(scalePercent);
    if (scaleFactor === null) {
      return null;
    }
    return `scale=iw*${scaleFactor}:ih*${scaleFactor}${flagsSuffix}`;
  }

  if (scaleMode === 'width') {
    const width = parsePositiveInteger(scaleWidth);
    if (width === null) {
      return null;
    }
    return `scale=${width}:-1${flagsSuffix}`;
  }

  if (scaleMode === 'height') {
    const height = parsePositiveInteger(scaleHeight);
    if (height === null) {
      return null;
    }
    return `scale=-2:${height}${flagsSuffix}`;
  }

  if (scaleMode === 'longestEdge') {
    const edge = parsePositiveInteger(scaleWidth);
    if (edge === null) {
      return null;
    }
    return `scale=${edge}:${edge}:force_original_aspect_ratio=decrease${flagsSuffix}`;
  }

  if (scaleMode === 'exact') {
    const width = parsePositiveInteger(scaleWidth);
    const height = parsePositiveInteger(scaleHeight);
    if (width === null && height === null) {
      return null;
    }
    if (width !== null && height !== null) {
      if (lockAspectRatio) {
        return `scale=${width}:${height}:force_original_aspect_ratio=decrease${flagsSuffix}`;
      }
      return `scale=${width}:${height}${flagsSuffix}`;
    }
    if (width !== null) {
      return `scale=${width}:-1${flagsSuffix}`;
    }
    return `scale=-1:${height}${flagsSuffix}`;
  }

  return null;
}

export function migrateLegacyScaleFields(stored: Record<string, unknown>) {
  const migrated: Partial<Record<string, string>> = {};

  if (typeof stored.videoResolution === 'string') {
    if (stored.videoResolution === 'original') {
      migrated.videoScaleMode = 'original';
    } else {
      migrated.videoScaleMode = 'height';
      migrated.videoScaleHeight = stored.videoResolution;
    }
  }

  if (typeof stored.gifWidth === 'string') {
    if (stored.gifWidth === 'original') {
      migrated.videoScaleMode = 'original';
    } else {
      migrated.videoScaleMode = 'width';
      migrated.videoScaleWidth = stored.gifWidth;
    }
  }

  if (typeof stored.imageResize === 'string') {
    if (stored.imageResize === 'original') {
      migrated.imageScaleMode = 'original';
    } else if (stored.imageResize.endsWith('%')) {
      migrated.imageScaleMode = 'percent';
      migrated.imageScalePercent = stored.imageResize.replace('%', '');
    } else {
      migrated.imageScaleMode = 'width';
      migrated.imageScaleWidth = stored.imageResize;
    }
  }

  return migrated;
}

export function validateScaleFields(
  scaleMode: ScaleMode,
  scaleWidth: string,
  scaleHeight: string,
  scalePercent: string,
): string | null {
  if (scaleMode === 'width' && parsePositiveInteger(scaleWidth) === null) {
    return 'invalidScaleWidth';
  }

  if (scaleMode === 'height' && parsePositiveInteger(scaleHeight) === null) {
    return 'invalidScaleHeight';
  }

  if (scaleMode === 'longestEdge' && parsePositiveInteger(scaleWidth) === null) {
    return 'invalidScaleLongestEdge';
  }

  if (scaleMode === 'exact') {
    const width = parsePositiveInteger(scaleWidth);
    const height = parsePositiveInteger(scaleHeight);
    if (width === null && height === null) {
      return 'invalidScaleExact';
    }
  }

  if (scaleMode === 'percent') {
    const percent = parsePositiveNumber(scalePercent.replace('%', ''));
    if (percent === null || percent > 100) {
      return 'invalidScalePercent';
    }
  }

  return null;
}
