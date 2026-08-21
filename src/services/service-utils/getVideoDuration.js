const { runCmdCapture } = require('./process');
const { getFfprobePath } = require('./binaryPaths');

/**
 * Reads a video's duration in seconds using ffprobe.
 *
 * @param {string} videoPath - Absolute path to the video file.
 * @returns {Promise<number>} Parsed duration in seconds.
 */
async function getVideoDuration(videoPath) {
    const ffProbePath = getFfprobePath();

    const { stdout } = await runCmdCapture(ffProbePath, [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        videoPath,
    ]);

    const dur = Number.parseFloat(String(stdout).trim());
    if (!Number.isFinite(dur) || dur <= 0) throw new Error(`getVideoDuration: Unable to read duration via ffprobe (${stdout})`);
    return dur;
}
module.exports = {
    getVideoDuration,
};
