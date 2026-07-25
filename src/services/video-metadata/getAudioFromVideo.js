const fs = require('fs');
const path = require('path');
const os = require('os');
const { runCmd } = require('../service-utils/process');
const { getFfmpegPath } = require('../service-utils/binaryPaths');
const { logLibraryError } = require('../logs/logService');

const hasAudioStream = (ffmpegOutput) => {
    return /Stream #\d+:\d+.*Audio:/i.test(ffmpegOutput);
};

const getAudioFromVideo = async (filePath) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-extraction-'));
    const audioPath = path.join(tmpDir, 'audio.wav');
    const ffmpegPath = getFfmpegPath();

    let finalAudioPath = null;

    try {
        let probeStderr = '';
        try {
            await runCmd(ffmpegPath, ['-hide_banner', '-i', filePath]);
        } catch (e) {
            // ffmpeg returns non-zero when no output is specified; we only care about the stderr text
            probeStderr = e.message || '';
        }

        const doesAudioExist = hasAudioStream(probeStderr);

        // extract only if audio is present.
        if (doesAudioExist) {
            await runCmd(ffmpegPath, ['-y', '-i', filePath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', audioPath]);
            finalAudioPath = audioPath;
        }

        return finalAudioPath;
    } finally {
        // If we did NOT produce an audio file, remove the tmp folder.
        // If we did produce audioPath, caller likely needs it, so don't delete here.
        if (!finalAudioPath) {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (_) {
                logLibraryError(`Error removing audio path: ${tmpDir}`);
            }
        }
    }
};

module.exports = {
    getAudioFromVideo,
};
