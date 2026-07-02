export type ScaleMode = 'original' | 'width' | 'height' | 'longestEdge' | 'exact' | 'percent';

export type MediaInfo = {
  width: number | null;
  height: number | null;
  frameRate: number | null;
  durationSeconds: number | null;
  videoCodec: string | null;
  totalBitrate: number | null;
  audioBitrate: number | null;
  audioChannels: number | null;
  hasAudio: boolean;
};

export type VideoConvertOptions = {
  videoFormat: string;
  videoCodecMode: string;
  videoQuality: string;
  framerateSelect: string;
  framerateCustom: string;
  videoFramerate: string;
  scaleMode: ScaleMode;
  scaleWidth: string;
  scaleHeight: string;
  scalePercent: string;
  lockAspectRatio: boolean;
  videoAudio: string;
  audioBitrateKbps: string;
  encoderPreset: string;
  stripMetadata: boolean;
  gifHighQuality: boolean;
  gifMaxColors: string;
  gifDither: string;
  gifLoop: string;
  gifLoopCount: string;
  trimStart: string;
  trimDuration: string;
};

export type ImageConvertOptions = {
  imageFormat: string;
  imageQuality: string;
  scaleMode: ScaleMode;
  scaleWidth: string;
  scaleHeight: string;
  scalePercent: string;
  lockAspectRatio: boolean;
  stripMetadata: boolean;
};

export type ConvertFormState = {
  preset: string;
  videoFormat: string;
  videoCodecMode: string;
  videoQualitySelect: string;
  videoQualityCustom: string;
  framerateSelect: string;
  framerateCustom: string;
  videoScaleMode: ScaleMode;
  videoScaleWidth: string;
  videoScaleHeight: string;
  videoScalePercent: string;
  videoLockAspectRatio: boolean;
  imageScaleMode: ScaleMode;
  imageScaleWidth: string;
  imageScaleHeight: string;
  imageScalePercent: string;
  imageLockAspectRatio: boolean;
  showAdvanced: boolean;
  videoAudio: string;
  audioBitrateKbps: string;
  encoderPreset: string;
  stripMetadata: boolean;
  gifHighQuality: boolean;
  gifMaxColorsSelect: string;
  gifMaxColorsCustom: string;
  gifDither: string;
  gifLoop: string;
  gifLoopCount: string;
  trimStart: string;
  trimDuration: string;
  imageFormat: string;
  imageQualitySelect: string;
  imageQualityCustom: string;
  includeParams: boolean;
};

export type OutputSubfolderSettings = {
  useSubfolder: boolean;
  subfolderName: string;
};

export type ConvertModalHint = {
  videoFormat?: string;
  videoCodecMode?: string;
  imageFormat?: string;
  preset?: string;
};

export type ClassifiableEntry = {
  path: string;
  name: string;
  isDirectory: boolean;
  extension?: string | null;
  size?: number;
};
