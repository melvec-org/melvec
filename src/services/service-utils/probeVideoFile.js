const { getFfprobePath } = require('./binaryPaths');
const { runCmdCapture } = require('./process');

/**
 * Returns { hasVideo, durationSec } in a single ffprobe invocation.
 * Avoids two separate process spawns for what is effectively the same header read.
 *
 * @param {string} videoPath - Absolute path to the video file.
 * @returns {Promise<{ hasVideo: boolean, durationSec: number }>}
 */
const probeVideoFile = async (videoPath) => {
    const ffprobePath = getFfprobePath();
    try {
        const { stdout } = await runCmdCapture(ffprobePath, [
            '-v',
            'error',
            '-show_entries',
            'format=duration:stream=codec_type',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            videoPath,
        ]);
        const lines = String(stdout)
            .trim()
            .split('\n')
            .map((l) => l.trim());
        const hasVideo = lines.includes('video');
        const durationSec = Number.parseFloat(lines.find((l) => /^\d/.test(l))) || 0;
        return { hasVideo, durationSec };
    } catch (_) {
        return { hasVideo: false, durationSec: 0 };
    }
};

module.exports = { probeVideoFile };
