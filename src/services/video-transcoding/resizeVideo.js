const path = require('path');
const { doesFileExist, ensureDir } = require('../service-utils/fileUtils');
const { runFfmpegWithProgress } = require('../service-utils/process');
const { getVideoDuration } = require('../service-utils/getVideoDuration');
const { logLibraryError } = require('../logs/logService');

const activeResizes = new Map(); // processId -> ChildProcess

/**
 * Resizes a video to the given dimensions.
 * @param {Object} config
 * @param {string} config.sourcePath
 * @param {number} config.width
 * @param {number} config.height
 * @param {string} [config.destinationDir='']
 * @param {(progress: Object) => void} [config.onProgress]
 * @returns {Promise<{processId: string, destinationPath: string}>}
 */
const resizeVideo = async (config) => {
    const processId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let { sourcePath, width, height, destinationDir = '', onProgress } = config || {};

    if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.trim() === '') {
        return Promise.reject(new Error('Path must be a non-empty string.'));
    }
    if (!doesFileExist(sourcePath)) {
        return Promise.reject(new Error('File does not exist.'));
    }

    width = Number(width);
    height = Number(height);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return Promise.reject(new Error('Width and height must be positive numbers.'));
    }

    // Ensure even dimensions for H.264 encodes (common requirement)
    width = Math.floor(width / 2) * 2;
    height = Math.floor(height / 2) * 2;

    destinationDir = destinationDir || path.dirname(sourcePath);
    ensureDir(destinationDir);

    const ext = path.extname(sourcePath);
    const baseName = path.basename(sourcePath, ext);
    const destinationPath = path.join(destinationDir, `${baseName}_${width}x${height}${ext}`);

    const totalDurationSec = Number(await getVideoDuration(sourcePath)) || 0;

    const args = [
        '-y',
        '-i',
        sourcePath,
        '-vf',
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        '-c:v',
        'libx264',
        '-crf',
        '20',
        '-preset',
        'medium',
        '-c:a',
        'copy',
        '-progress',
        'pipe:1',
        '-nostats',
        destinationPath,
    ];
    try {
        await runFfmpegWithProgress(
            args,
            (p) => {
                const outTimeSec = Number(p?.outTimeMs || 0) / 1000 || 0;
                const percent = totalDurationSec > 0 ? Math.max(0, Math.min(100, Math.floor((outTimeSec / totalDurationSec) * 100))) : 0;

                if (typeof onProgress === 'function') {
                    onProgress({
                        ...p,
                        percent,
                        totalDurationSec,
                        destinationPath,
                        processId,
                    });
                }
            },
            (child) => {
                activeResizes.set(processId, child);
                child.on('close', () => {
                    activeResizes.delete(processId);
                });
            },
        );

        return { processId, destinationPath };
    } finally {
        activeResizes.delete(processId);
    }
};

const stopResize = (processId) => {
    if (!processId) return false;
    const child = activeResizes.get(processId);
    if (!child) return false;

    try {
        child.kill('SIGTERM');
    } catch (_) {
        logLibraryError('', `Failed to stop resize process ${processId}`);
    }
    activeResizes.delete(processId);
    return true;
};

module.exports = {
    resizeVideo,
    stopResize,
};
