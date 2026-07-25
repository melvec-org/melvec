const fs = require('fs');
const path = require('path');
const { runCmd } = require('./process');
const { getFfmpegPath } = require('./binaryPaths');
const { getVideoDuration } = require('./getVideoDuration');

const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;

/**
 * ffmpeg based thubnail generation. This is more efficient and can create optimized thumbnails.
 * Note: Front end canvas based thumbnail is more crisp, good quality. It takes negligibly slower time to create.
 * @param {*} param0
 * @returns
 */
const generateVideoThumbnail = async ({
    videoPath,
    maxWidth = THUMBNAIL_WIDTH,
    maxHeight = THUMBNAIL_HEIGHT,
    thumbnailFolder,
    videoId,
}) => {
    if (!videoPath) throw new Error('createThumbnail: videoPath not found');
    if (!fs.existsSync(videoPath)) throw new Error(`createThumbnail: Video file not found: ${videoPath}`);

    if (!maxWidth || !maxHeight) throw new Error('createThumbnail: maxWidth and maxHeight must be provided');

    if (!thumbnailFolder) throw new Error('createThumbnail: thumbnailFolder not found');

    if (!videoId) throw new Error('createThumbnail: videoId not found');

    if (!fs.existsSync(thumbnailFolder)) {
        await fs.promises.mkdir(thumbnailFolder, { recursive: true });
    }

    const thumbnailPath = path.join(thumbnailFolder, `${videoId}.jpg`);

    const duration = await getVideoDuration(videoPath);
    const t = Math.max(0, duration / 2);

    const ffmpegPath = getFfmpegPath();

    await runCmd(ffmpegPath, [
        '-ss',
        String(t),
        '-y',
        '-i',
        videoPath,
        '-frames:v',
        '1',
        '-vf',
        `scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,unsharp=5:5:0.6:3:3:0.2`,
        '-c:v',
        'mjpeg',
        '-pix_fmt',
        'yuvj444p',
        '-q:v',
        '1',
        thumbnailPath,
    ]);

    if (!fs.existsSync(thumbnailPath)) throw new Error('createThumbnail: Failed to generate thumbnail');
    return thumbnailPath;
};

module.exports = { generateVideoThumbnail };
