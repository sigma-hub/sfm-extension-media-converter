# Media Converter - Sigma File Manager Extension

Convert videos and images to other formats directly from Sigma File Manager using FFmpeg.

## Features

- Convert videos between formats (MP4, MKV, WebM, AVI, MOV)
- Convert videos to high-quality GIFs with palette optimization
- Convert images between formats (PNG, JPG, WebP, AVIF, BMP, TIFF)
- Reduce image file size without losing perceived quality
- Change video framerate and resolution
- Re-encode videos with configurable quality (CRF)
- Stream-copy mode for fast lossless container changes
- Remove audio from videos
- Batch convert multiple files at once
- Intelligently separates images and videos in mixed selections
- Progress tracking with cancellation support
- Cross-platform: Windows, macOS, Linux

## Usage

### Context Menu

1. Select one or more media files in the file browser
2. Right-click and choose **Convert** from the context menu
3. Configure conversion options in the modal dialog
4. Click **Convert** to start

### Command Palette

1. Open the command palette
2. Run **Convert Media**
3. The extension will use the currently selected files

## Conversion Options

### Video Options

| Option | Choices |
|--------|---------|
| Output format | MP4, MKV, WebM, AVI, MOV, GIF |
| Codec mode | Auto (re-encode), Copy (fast, no quality loss) |
| Video quality | High (CRF 18), Medium (CRF 23), Low (CRF 28), Lossless (CRF 0) |
| Framerate | Keep original, 60/30/24/15/10 fps |
| Resolution | Keep original, 1080p, 720p, 480p, 360p |
| Audio | Keep, Remove, Copy stream |

### GIF Options (when GIF output is selected)

| Option | Choices |
|--------|---------|
| Width | Keep original, 640px, 480px, 320px, 240px |
| High quality palette | Enabled/Disabled (uses two-pass palette generation) |

### Image Options

| Option | Choices |
|--------|---------|
| Output format | PNG, JPG, WebP, AVIF, BMP, TIFF |
| Quality | Highest (100), High (90), Medium (75), Low (50) |
| Resize | Keep original, 75%, 50%, 25%, 1920px, 1280px, 800px wide |

## Supported Formats

### Video Input
mp4, mkv, webm, avi, mov, wmv, flv, ts, mts, m4v, 3gp

### Image Input
png, jpg, jpeg, webp, bmp, tiff, tif, avif, gif

## Requirements

- FFmpeg is automatically downloaded and managed by the extension
