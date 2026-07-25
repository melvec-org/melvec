const { respondError, respondSuccess, respondFailure, streamToUI } = require('../service-utils/sendToUI');
const { getBatchGenStatus, startImageMetaDataBatchGeneration, stopImageMetaDataBatchGeneration } = require('./batchGenerateImageMetaData');
const { generateImageMetaData, stopGeneratingImageMetadata, getEmbedding } = require('./generateImageMetaData');
const { getImageDetailsById, getImageDescriptionById, updateDescriptionAndEmbedding } = require('../database/imageLibraryDbService');
const { updateImageMetaData, updateImageTitle } = require('../image-library/imageLibrary');
const { getLibDir } = require('../servicePathConfig');
const { getModelTier } = require('../ai-models/models');
const { createJobQueue } = require('../service-utils/jobQueue');
const mainThreadEvents = require('../../events/mainThreadEvents');
const path = require('path');

const imageDescriptionJobQueue = createJobQueue({
    processJob: async (config) => {
        const { imageId, fullImagePath, modelTier, shouldGenerateTitle } = config;

        const imageMetaData = await generateImageMetaData(imageId, fullImagePath, modelTier, shouldGenerateTitle);

        if (imageMetaData.description.length > 5 && imageMetaData.embedding) {
            updateImageMetaData(imageId, imageMetaData.description, imageMetaData.embedding);
        }
        if (imageMetaData.title !== '' && shouldGenerateTitle) {
            updateImageTitle(imageId, imageMetaData.title);
        }

        return imageMetaData;
    },
    stopJob: async (config, jobId) => {
        try {
            await stopGeneratingImageMetadata(jobId);
        } catch (e) {
            throw new Error('Failed to stop image description generation job.');
        }
    },
    progressHandler: ({ jobId, status, result, error }) => {
        if (status === 'completed') {
            streamToUI(mainThreadEvents.ON_IMAGE_DESCRIPTION_GENERATED, {
                imageId: jobId,
                status: 'completed',
                description: result.description,
                descriptionSource: 'ai',
            });
        } else if (status === 'failed') {
            streamToUI(mainThreadEvents.ON_IMAGE_DESCRIPTION_GENERATED, {
                imageId: jobId,
                status: 'failed',
                error,
            });
        } else if (status === 'cancelled') {
            streamToUI(mainThreadEvents.ON_IMAGE_DESCRIPTION_GENERATED, {
                imageId: jobId,
                status: 'cancelled',
            });
        } else {
            streamToUI(mainThreadEvents.ON_IMAGE_DESCRIPTION_GENERATED, {
                imageId: jobId,
                status,
            });
        }
    },
});

const generateImageDescriptionService = (imageId, shouldGenerateTitle) => {
    const imageDetails = getImageDetailsById(imageId);
    const fullImagePath = path.join(getLibDir(), imageDetails.path);
    const modelTier = getModelTier();

    const existingTitle = typeof imageDetails?.title === 'string' ? imageDetails.title.trim() : '';
    const generateTitle = existingTitle === '' || shouldGenerateTitle;

    const enqueueResult = imageDescriptionJobQueue.enqueue(imageId, {
        imageId,
        fullImagePath,
        modelTier,
        shouldGenerateTitle: generateTitle,
    });

    return respondSuccess('Image description generation status', {
        imageId,
        accepted: enqueueResult.accepted,
        status: enqueueResult.status,
        queuePosition: enqueueResult.queuePosition,
    });
};

const stopGeneratingImageDescriptionService = async (imageId) => {
    try {
        await imageDescriptionJobQueue.cancel(imageId);
        return respondSuccess('Job stopped');
    } catch (e) {
        return respondError(`${e}`);
    }
};

const startImageMetaDataBatchGenerationService = () => {
    try {
        const currentProcessState = getBatchGenStatus();

        if (currentProcessState.status === 'processing') {
            return respondFailure('Batch image metadata generation is already in progress.', currentProcessState);
        } else {
            startImageMetaDataBatchGeneration();
            return respondSuccess('Batch image metadata generation started successfully');
        }
    } catch (e) {
        return respondError(`Failed to start batch image metadata generation: ${e}`);
    }
};

const stopBatchImageMetaDataGenerationService = () => {
    try {
        const currentProcessState = getBatchGenStatus();
        if (currentProcessState.status === 'stopped' || currentProcessState.status === 'stopping') {
            return respondFailure('Batch image metadata generation is already stopped or stopping.');
        }
        stopImageMetaDataBatchGeneration();
        return respondSuccess('Batch image metadata generation stopped successfully');
    } catch (e) {
        return respondError(`Failed to stop batch image metadata generation: ${e}`);
    }
};

const setImageDescriptionService = async (imageId, description) => {
    try {
        const embedding = await getEmbedding(imageId, description);
        updateImageMetaData(imageId, description, embedding);
        return respondSuccess('Image description updated successfully', description);
    } catch (error) {
        return respondError(`Failed to set image description: ${error.message}`);
    }
};

const getImageMetaDataDetailsService = (imageId) => {
    try {
        const description = getImageDescriptionById(imageId);
        return respondSuccess('Image metadata details found', { description });
    } catch (e) {
        return respondError(`Failed to get image metadata details: ${e.message}`);
    }
};

module.exports = {
    generateImageDescriptionService,
    stopGeneratingImageDescriptionService,
    setImageDescriptionService,
    getImageMetaDataDetailsService,
    // as images do not have separate metadata service, so no need to initalize metadatadb service
    startImageMetaDataBatchGenerationService,
    stopBatchImageMetaDataGenerationService,
};
