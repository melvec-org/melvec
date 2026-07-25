const path = require('path');
const { doesFileExist, ensureDir } = require('../service-utils/fileUtils');
const { runFfmpegWithProgress } = require('../service-utils/process');
const { getVideoDuration } = require('../service-utils/getVideoDuration');

const activeOptimizations = new Map(); // processId -> ChildProcess

/**
 * Optimizes video to save space with a quality factor.
 * @param {Object} config
 * @param {string} config.sourcePath
 * @param {number} [config.quality=80] 0..100 (higher => better quality)
 * @param {string} [config.destinationDir='']
 * @param {(progress: Object) => void} [config.onProgress]
 * @returns {Promise<{processId: string, destinationPath: string}>}
 */
const optimizeVideo = async (config) => {
    const processId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    let { sourcePath, quality = 80, destinationDir = '', onProgress } = config || {};

    if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.trim() === '') {
        return Promise.reject(new Error('Path must be a non-empty string.'));
    }

    if (typeof quality !== 'number' || Number.isNaN(quality) || quality < 0 || quality > 100) {
        return Promise.reject(new Error('Quality must be a number between 0 and 100.'));
    }

    if (!doesFileExist(sourcePath)) {
        return Promise.reject(new Error('File does not exist.'));
    }

    destinationDir = destinationDir || path.dirname(sourcePath);

    // create destination directory if it doesn't exist
    ensureDir(destinationDir);

    const ext = path.extname(sourcePath); // includes leading dot
    const baseName = path.basename(sourcePath, ext);
    const destinationPath = path.join(destinationDir, `${baseName}_optimized_${quality}${ext}`);

    const totalDurationSec = Number(await getVideoDuration(sourcePath)) || 0;

    const clampedQuality = Math.max(0, Math.min(100, quality));
    // 0..100 -> CRF 35..18 (lower CRF = better)
    const crf = Math.round(35 - (clampedQuality * (35 - 18)) / 100);

    const args = [
        '-y',
        '-i',
        sourcePath,
        '-c:v',
        'libx264',
        '-crf',
        String(crf),
        // Keep audio as-is to speed up and reduce quality loss; change if you need re-encode
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
                activeOptimizations.set(processId, child);

                child.on('close', () => {
                    activeOptimizations.delete(processId);
                });
            },
        );

        return { processId, destinationPath };
    } finally {
        activeOptimizations.delete(processId);
    }
};

const stopOptimization = async (processId) => {
    if (processId === undefined) {
        const first = activeOptimizations.keys().next().value;
        if (first) processId = first;
    }

    const child = activeOptimizations.get(processId);
    if (!child) {
        return Promise.reject(new Error('No active optimization found for the provided processId.'));
    }

    try {
        child.kill('SIGTERM');
        return true;
    } catch (err) {
        return { status: 'error', message: 'Failed to stop optimization', error: err };
    }
};

module.exports = {
    optimizeVideo,
    stopOptimization,
};
