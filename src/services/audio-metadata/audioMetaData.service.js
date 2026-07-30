const { respondError, respondSuccess, respondFailure, streamToUI } = require('../service-utils/sendToUI');
const { getBatchGenStatus, startAudioMetaDataBatchGeneration, stopAudioMetaDataBatchGeneration } = require('./batchGenerateAudioMetaData');
const { generateAudioMetaData, stopGeneratingAudioMetadata, getEmbedding } = require('./generateAudioMetaData');
const { getAudioDetailsById, getAudioDescriptionById } = require('../database/audioLibraryDbService');
const { updateAudioMetaData, updateAudioTitle } = require('../audio-library/audioLibrary');
const { getLibDir } = require('../servicePathConfig');
const { getModelTier } = require('../ai-models/models');
const { createJobQueue } = require('../service-utils/jobQueue');
const mainThreadEvents = require('../../events/mainThreadEvents');
const path = require('path');

const { isAIActive } = require('../service-utils/ai');

const audioDescriptionJobQueue = createJobQueue({
    processJob: async (config) => {
        const { audioId, fullAudioPath, modelTier, shouldGenerateTitle } = config;

        const audioMetaData = await generateAudioMetaData(audioId, fullAudioPath, modelTier, shouldGenerateTitle);

        if (audioMetaData.description.length > 5 && audioMetaData.embedding) {
            updateAudioMetaData(audioId, audioMetaData.description, audioMetaData.embedding);
        }
        if (audioMetaData.title !== '' && shouldGenerateTitle) {
            updateAudioTitle(audioId, audioMetaData.title);
        }

        return audioMetaData;
    },
    stopJob: async (config, jobId) => {
        try {
            await stopGeneratingAudioMetadata(jobId);
        } catch (e) {
            throw new Error('Failed to stop audio description generation job.');
        }
    },
    progressHandler: ({ jobId, status, result, error }) => {
        if (status === 'completed') {
            streamToUI(mainThreadEvents.ON_AUDIO_DESCRIPTION_GENERATED, {
                audioId: jobId,
                status: 'completed',
                description: result.description,
                descriptionSource: 'ai',
            });
        } else if (status === 'failed') {
            streamToUI(mainThreadEvents.ON_AUDIO_DESCRIPTION_GENERATED, {
                audioId: jobId,
                status: 'failed',
                error,
            });
        } else if (status === 'cancelled') {
            streamToUI(mainThreadEvents.ON_AUDIO_DESCRIPTION_GENERATED, {
                audioId: jobId,
                status: 'cancelled',
            });
        } else {
            streamToUI(mainThreadEvents.ON_AUDIO_DESCRIPTION_GENERATED, {
                audioId: jobId,
                status,
            });
        }
    },
});

const generateAudioDescriptionService = (audioId, shouldGenerateTitle) => {
    const audioDetails = getAudioDetailsById(audioId);
    const fullAudioPath = path.join(getLibDir(), audioDetails.path);
    const modelTier = getModelTier();

    const existingTitle = typeof audioDetails?.title === 'string' ? audioDetails.title.trim() : '';
    const generateTitle = existingTitle === '' || shouldGenerateTitle;

    const enqueueResult = audioDescriptionJobQueue.enqueue(audioId, {
        audioId,
        fullAudioPath,
        modelTier,
        shouldGenerateTitle: generateTitle,
    });

    return respondSuccess('Audio description generation status', {
        audioId,
        accepted: enqueueResult.accepted,
        status: enqueueResult.status,
        queuePosition: enqueueResult.queuePosition,
    });
};

const stopGeneratingAudioDescriptionService = async (audioId) => {
    try {
        await audioDescriptionJobQueue.cancel(audioId);
        return respondSuccess('Job stopped');
    } catch (e) {
        return respondError(`${e}`);
    }
};

const startAudioMetaDataBatchGenerationService = () => {
    try {
        const currentProcessState = getBatchGenStatus();

        if (currentProcessState.status === 'processing') {
            return respondFailure('Batch audio metadata generation is already in progress.', currentProcessState);
        } else {
            startAudioMetaDataBatchGeneration();
            return respondSuccess('Batch audio metadata generation started successfully');
        }
    } catch (e) {
        return respondError(`Failed to start batch audio metadata generation: ${e}`);
    }
};

const stopBatchAudioMetaDataGenerationService = () => {
    try {
        const currentProcessState = getBatchGenStatus();
        if (currentProcessState.status === 'stopped' || currentProcessState.status === 'stopping') {
            return respondFailure('Batch audio metadata generation is already stopped or stopping.');
        }
        stopAudioMetaDataBatchGeneration();
        return respondSuccess('Batch audio metadata generation stopped successfully');
    } catch (e) {
        return respondError(`Failed to stop batch audio metadata generation: ${e}`);
    }
};

const setAudioDescriptionService = async (audioId, description) => {
    try {
        // use embedding if ai is enabled and description is not empty
        if (isAIActive()) {
            const embedding = await getEmbedding(audioId, description);
            updateAudioMetaData(audioId, description, embedding);
        } else {
            updateAudioMetaData(audioId, description, '');
        }

        return respondSuccess('Audio description updated successfully', description);
    } catch (error) {
        return respondError(`Failed to set audio description: ${error.message}`);
    }
};

const getAudioMetaDataDetailsService = (audioId) => {
    try {
        const description = getAudioDescriptionById(audioId);
        return respondSuccess('Audio metadata details found', { description });
    } catch (e) {
        return respondError(`Failed to get audio metadata details: ${e.message}`);
    }
};

module.exports = {
    generateAudioDescriptionService,
    stopGeneratingAudioDescriptionService,
    setAudioDescriptionService,
    getAudioMetaDataDetailsService,
    startAudioMetaDataBatchGenerationService,
    stopBatchAudioMetaDataGenerationService,
};
