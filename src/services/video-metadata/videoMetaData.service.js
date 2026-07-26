const { generateTranscriptAsync, getAudioTranscript } = require('./generateTranscript');

const {
    initializeMetadataDbService,
    getShortVideoDescriptionById,
    getMetaDataById,
    setDescription,
    setGeneratedVideoMetaData,
    setEmbeddingData,
} = require('../database/metaDataDbService');
const { respondSuccess, respondError, streamToUI, respondFailure } = require('../service-utils/sendToUI');
const { generateVideoMetadata, stopGeneratingVideoMetadata, generateEmbeddingsFromDescription } = require('./generateVideoMetaData');
const { getVideoDetailsById, getAllVideoIds } = require('../database/videoLibraryDbService');
const { getLibDir } = require('../servicePathConfig');
const path = require('path');
const { getModelTier } = require('../ai-models/models');
const { startMetaDataBatchGeneration, getBatchGenStatus, stopMetaDataBatchGeneration } = require('./batchGenerateVideoMetaData');
const { udpateVideoTitle, updateVideoCategory } = require('../video-library/videoLibrary');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { createJobQueue } = require('../service-utils/jobQueue');
const mainThreadEvents = require('../../events/mainThreadEvents');
const { getBasicVideoDetailsById } = require('../video-library/videoLibrary.service');
const indexingEvents = require('../../events/indexingEvents');

const notifyIntegrityChange = (videoId) => {
    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
        change: indexingEvents.VIDEO_META_DATA_CHANGE,
        videoId: videoId,
    });
};

const videoDescriptionJobQueue = createJobQueue({
    processJob: async (config) => {
        const { videoId, fullVideoPath, modelTier, shouldGenerateTitle } = config;

        const videoMetaData = await generateVideoMetadata(videoId, fullVideoPath, modelTier, shouldGenerateTitle);

        if (videoMetaData.description.length > 5) {
            setGeneratedVideoMetaData(videoId, videoMetaData, 'ai');
        }

        if (shouldGenerateTitle && videoMetaData.generatedTitle?.trim() !== '') {
            udpateVideoTitle(videoId, videoMetaData.generatedTitle);
        }

        const videoDetails = getBasicVideoDetailsById(videoId);

        if (videoMetaData.categoryId !== null && videoDetails.categoryId === null) {
            updateVideoCategory(videoId, videoMetaData.categoryId);
        }

        notifyIntegrityChange(videoId);

        return videoMetaData;
    },
    stopJob: async (config, jobId) => {
        try {
            stopGeneratingVideoMetadata(jobId);
        } catch (e) {
            throw new Error('Failed to stop video description generation job.');
        }
    },
    progressHandler: ({ jobId, status, result, error }) => {
        if (status === 'completed') {
            streamToUI(mainThreadEvents.ON_VIDEO_DESCRIPTION_GENERATED, {
                videoId: jobId,
                status: 'completed',
                transcript: result.audioTranscript,
                description: result.description,
                transcriptSource: 'ai',
                descriptionSource: 'ai',
            });
        } else if (status === 'failed') {
            streamToUI(mainThreadEvents.ON_VIDEO_DESCRIPTION_GENERATED, {
                videoId: jobId,
                status: 'failed',
                error,
            });
        } else if (status === 'cancelled') {
            streamToUI(mainThreadEvents.ON_VIDEO_DESCRIPTION_GENERATED, {
                videoId: jobId,
                status: 'cancelled',
            });
        } else {
            streamToUI(mainThreadEvents.ON_VIDEO_DESCRIPTION_GENERATED, {
                videoId: jobId,
                status,
            });
        }
    },
});

// user dirven video description
const setVideoMetaDataDescriptionService = async (videoId, description) => {
    try {
        setDescription(videoId, description, 'user');
        notifyIntegrityChange(videoId);
        // extract normalized description and embedding based on the new description.
        const embeddingData = await generateEmbeddingsFromDescription(videoId, description);
        setEmbeddingData(videoId, embeddingData);
        return respondSuccess('Video metadata description updated successfully', description);
    } catch (error) {
        return respondError(error);
    }
};

const getVideoMetaDataDetails = async (videoId) => {
    try {
        const data = getMetaDataById(videoId);

        return respondSuccess('Video Metadata description found', data);
    } catch (error) {
        return respondError(`Failed to get Video Metadata: ${error.message}`);
    }
};

const getShortVideoDescriptionService = async (videoId) => {
    try {
        const shortDescription = await getShortVideoDescriptionById(videoId);
        return respondSuccess('Short Video Description found', shortDescription);
    } catch (error) {
        return respondError('Short Video Description not found', '');
    }
};

const generateVideoDescriptionService = (videoId, shouldGenerateTitle) => {
    const videoDetails = getVideoDetailsById(videoId);
    const fullVideoPath = path.join(getLibDir(), videoDetails.path);
    const modelTier = getModelTier();

    const existingTitle = typeof videoDetails?.title === 'string' ? videoDetails.title.trim() : '';
    const generateTitle = existingTitle === '' || shouldGenerateTitle;

    const enqueueResult = videoDescriptionJobQueue.enqueue(videoId, {
        videoId,
        fullVideoPath,
        modelTier,
        shouldGenerateTitle: generateTitle,
    });

    return respondSuccess('Video description generation status', {
        videoId,
        accepted: enqueueResult.accepted,
        status: enqueueResult.status,
        queuePosition: enqueueResult.queuePosition,
    });
};

const generateTranscriptService = async (videoId) => {
    try {
        const videoDetails = getVideoDetailsById(videoId);
        const fullVideoPath = path.join(getLibDir(), videoDetails.path);

        const audioTranscript = await generateTranscriptAsync(videoId, fullVideoPath);
        return respondSuccess('Video Transcript found', audioTranscript);
    } catch (e) {
        return respondError(`Failed to get Video Transcript: ${e.message}`);
    }
};

const stopGeneratingVideoDescriptionService = async (videoId) => {
    try {
        await videoDescriptionJobQueue.cancel(videoId);

        return respondSuccess('Job stopped');
    } catch (e) {
        return respondError(`${e}`);
    }
};

const startBatchVideoMetaDataGenerationService = async (videoIds = []) => {
    // first check for videoDescription availability.

    if (videoIds === undefined) {
        return respondError('No video ids provided.');
    }
    try {
        // if no videoIds provided, get all videoIds.
        if (videoIds.length === 0) {
            videoIds = getAllVideoIds();
        }
        const currentProcessState = getBatchGenStatus();

        if (currentProcessState.status === 'processing') {
            return respondFailure('Batch video description generation is already in progress.');
        } else {
            startMetaDataBatchGeneration(videoIds);
            return respondSuccess('Batch video description generation started successfully');
        }
    } catch (e) {
        return respondError(`Failed to start batch video description generation: ${e}`);
    }
};

const stopBatchVideoMetaDataGenerationService = async () => {
    try {
        const currentProcessState = getBatchGenStatus();
        if (currentProcessState.status === 'stopped' || currentProcessState.status === 'stopping') {
            return respondFailure('Batch video description generation is already stopped or stopping.');
        }
        stopMetaDataBatchGeneration();
        return respondSuccess('Batch video description generation stopped successfully');
    } catch (e) {
        return respondError(`Failed to stop batch video description generation: ${e}`);
    }
};

const initMetaDataService = () => {
    initializeMetadataDbService();
};

module.exports = {
    initVideoMetaDataService: initMetaDataService,
    getVideoMetaDataDetails,
    setVideoMetaDataDescriptionService,
    generateVideoDescriptionService,
    generateTranscriptService,
    getShortVideoDescriptionService,
    stopGeneratingVideoDescriptionService,
    startBatchVideoMetaDataGenerationService,
    stopBatchVideoMetaDataGenerationService,
};
