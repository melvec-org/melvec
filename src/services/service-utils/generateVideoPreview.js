const fs = require('fs');
const path = require('path');
const { runCmd } = require('./process');
const { getFfmpegPath } = require('./binaryPaths');
const { probeVideoFile } = require('./probeVideoFile');

const NO_VISUAL_STREAM = 'NA';

const PREVIEW_DURATION_SECONDS = 5;
const PREVIEW_WIDTH = 320;
const PREVIEW_HEIGHT = 180;

/**
 * Preview start time need to match with the logic of thumbnail generation. So that the preview play is smoother.
 * @param {*} duration
 * @param {*} previewDuration
 * @returns
 */
const getPreviewStartTime = (duration, previewDuration = PREVIEW_DURATION_SECONDS) => {
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error('createPreview: Invalid video duration');
    }

    const desiredStart = duration > 10 ? duration / 2 : 0;
    const maxAllowedStart = Math.max(0, duration - previewDuration);

    return Math.min(desiredStart, maxAllowedStart);
};

const generateVideoPreview = async ({
    videoPath,
    previewFolder,
    videoId,
    previewDuration = PREVIEW_DURATION_SECONDS,
    maxWidth = PREVIEW_WIDTH,
    maxHeight = PREVIEW_HEIGHT,
}) => {
    if (!videoPath) throw new Error('createPreview: videoPath not found');
    if (!fs.existsSync(videoPath)) throw new Error(`createPreview: Video file not found: ${videoPath}`);
    if (!previewFolder) throw new Error('createPreview: previewFolder not found');
    if (!videoId) throw new Error('createPreview: videoId not found');
    if (!maxWidth || !maxHeight) throw new Error('createPreview: maxWidth and maxHeight must be provided');

    if (!fs.existsSync(previewFolder)) {
        await fs.promises.mkdir(previewFolder, { recursive: true });
    }

    const { hasVideo, durationSec } = await probeVideoFile(videoPath);

    if (!hasVideo) return NO_VISUAL_STREAM;

    const previewPath = path.join(previewFolder, `${videoId}.mp4`);
    const startTime = getPreviewStartTime(durationSec, previewDuration);
    const effectiveDuration = Math.min(previewDuration, durationSec);

    const ffmpegPath = getFfmpegPath();

    await runCmd(ffmpegPath, [
        '-ss',
        String(startTime),
        '-y',
        '-i',
        videoPath,
        '-t',
        String(effectiveDuration),
        '-an',
        '-vf',
        `scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=${maxWidth}:${maxHeight}:(ow-iw)/2:(oh-ih)/2:black`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '28',
        '-movflags',
        '+faststart',
        previewPath,
    ]);

    if (!fs.existsSync(previewPath)) throw new Error('createPreview: Failed to generate preview');
    return previewPath;
};

module.exports = {
    generateVideoPreview,
    getPreviewStartTime,
    NO_VISUAL_STREAM,
};
