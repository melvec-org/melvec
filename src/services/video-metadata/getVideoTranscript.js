const fs = require('fs');

const { getAudioFromVideo } = require('./getAudioFromVideo');
const { MAX_TRANSCRIPT_LENGTH } = require('../../configs/appConfig');
const { runCmdCapture } = require('../service-utils/process');
const { getWhisperCliPath } = require('../service-utils/binaryPaths');
const { getModelPath } = require('../ai-models/models');

const sanitizeTranscript = (transcript) => {
    const normalizedTranscript = String(transcript || '').trim();
    const voidTranscripts = ['[BALNK_AUDIO]', '[SILENCE]', '[MUSIC]'];

    if (voidTranscripts.includes(normalizedTranscript)) return '';
    return normalizedTranscript;
};

const getVideoTranscript = async (videoPath) => {
    if (videoPath === '') return null;
    const audioPath = await getAudioFromVideo(videoPath);

    if (!audioPath) return '';

    if (!fs.existsSync(audioPath)) throw new Error('Audio file not found in temp folder');

    const modelPath = getModelPath('whisper');

    const outBase = audioPath.replace(/\.wav$/i, '') + '_whisper';
    const outTxt = `${outBase}.txt`;
    const whisperCliPath = getWhisperCliPath();

    const candidates = [{ cmd: whisperCliPath, args: ['-m', modelPath, '-f', audioPath, '-otxt', '-of', outBase] }];

    let lastErr = null;

    for (const c of candidates) {
        try {
            await runCmdCapture(c.cmd, c.args);

            if (!fs.existsSync(outTxt)) throw new Error(`Whisper finished but output missing: ${outTxt}`);
            let transcript = fs.readFileSync(outTxt, 'utf8');
            transcript = sanitizeTranscript(transcript);
            if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
                transcript = transcript.slice(0, MAX_TRANSCRIPT_LENGTH);
            }
            return transcript;
        } catch (e) {
            lastErr = e;
        }
    }

    throw lastErr || new Error('Failed to generate transcript');
};

module.exports = {
    getVideoTranscript,
};
