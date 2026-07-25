const { setAudioTranscript, getMetaDataById } = require('../database/metaDataDbService');
const { logLibraryError } = require('../logs/logService');
const { getVideoTranscript } = require('./getVideoTranscript');
const path = require('path');

const jobQueue = new Map();

let isTranscriptionInProgress = false;

// This will generate and save the transcript

const generateTranscript = (videoId, videoPath) => {
    jobQueue.set(videoId, videoPath);

    if (!isTranscriptionInProgress) {
        startTranscription();
    }
};

const startTranscription = async () => {
    isTranscriptionInProgress = true;
    while (jobQueue.size > 0) {
        const [videoId, videoPath] = jobQueue.entries().next().value;

        try {
            const transcript = await getVideoTranscript(videoPath);

            setAudioTranscript(videoId, transcript);
        } catch (error) {
            logLibraryError(`Transcriptcould not be generated for ${videoPath}`);
        } finally {
            jobQueue.delete(videoId);
        }
    }
    isTranscriptionInProgress = false;
    return true;
};

//
const generateTranscriptAsync = async (videoId, videoPath) => {
    const transcript = await getVideoTranscript(videoPath);
    setAudioTranscript(videoId, transcript, 'ai');

    return transcript;
};

/**
 * Check if audio transcript is available in the database. If not, generate it.
 * @param {*} videoId
 * @param {*} videoPath
 * @returns
 */
const getAudioTranscript = async (videoId, videoPath) => {
    const metaData = getMetaDataById(videoId);
    let transcript = '';
    if (!metaData.transcript) {
        transcript = await generateTranscriptAsync(videoId, videoPath);
        return transcript;
    } else {
        return metaData.transcript;
    }
};

module.exports = {
    generateTranscript,
    generateTranscriptAsync,
    getAudioTranscript,
};
