const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { runCmd } = require('./process');
const { getFfmpegPath } = require('./binaryPaths');

const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;

const execFileAsync = (command, args = []) =>
    new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve({ stdout, stderr });
        });
    });

const generateImageThumbnailWithSips = async ({ imagePath, thumbnailPath, maxWidth }) => {
    await execFileAsync('sips', ['-s', 'format', 'jpeg', '-Z', String(maxWidth), imagePath, '--out', thumbnailPath]);
};

const generateImageThumbnailWithFfmpeg = async ({ imagePath, thumbnailPath, maxWidth, maxHeight }) => {
    const ffmpegPath = getFfmpegPath();

    await runCmd(ffmpegPath, [
        '-y',
        '-i',
        imagePath,
        '-vf',
        `scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=${maxWidth}:${maxHeight}:(ow-iw)/2:(oh-ih)/2:black`,
        '-frames:v',
        '1',
        '-c:v',
        'mjpeg',
        '-pix_fmt',
        'yuvj444p',
        '-q:v',
        '2',
        thumbnailPath,
    ]);
};

const generateImageThumbnail = async ({
    imagePath,
    maxWidth = THUMBNAIL_WIDTH,
    maxHeight = THUMBNAIL_HEIGHT,
    thumbnailFolder,
    imageId,
}) => {
    if (!imagePath) throw new Error('generateImageThumbnail: imagePath not found');
    if (!fs.existsSync(imagePath)) throw new Error(`generateImageThumbnail: Image file not found: ${imagePath}`);
    if (!maxWidth || !maxHeight) throw new Error('generateImageThumbnail: maxWidth and maxHeight must be provided');
    if (!thumbnailFolder) throw new Error('generateImageThumbnail: thumbnailFolder not found');
    if (!imageId) throw new Error('generateImageThumbnail: imageId not found');

    if (!fs.existsSync(thumbnailFolder)) {
        await fs.promises.mkdir(thumbnailFolder, { recursive: true });
    }

    const thumbnailPath = path.join(thumbnailFolder, `${imageId}.jpg`);

    if (process.platform === 'darwin') {
        try {
            await generateImageThumbnailWithSips({
                imagePath,
                thumbnailPath,
                maxWidth,
            });
        } catch (_) {
            await generateImageThumbnailWithFfmpeg({
                imagePath,
                thumbnailPath,
                maxWidth,
                maxHeight,
            });
        }
    } else {
        await generateImageThumbnailWithFfmpeg({
            imagePath,
            thumbnailPath,
            maxWidth,
            maxHeight,
        });
    }

    if (!fs.existsSync(thumbnailPath)) {
        throw new Error('generateImageThumbnail: Failed to generate thumbnail');
    }

    return thumbnailPath;
};

module.exports = { generateImageThumbnail };
