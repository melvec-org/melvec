const path = require('path');
const interServiceEvents = require('../../events/interServiceEvents');
const mainThreadEvents = require('../../events/mainThreadEvents');
const { streamToUI } = require('../service-utils/sendToUI');
const serviceEventBus = require('../service-utils/serviceEventBus');
const { getImageListWithoutDescription, getImageDetailsById, updateDescriptionAndEmbedding } = require('../database/imageLibraryDbService');
const { getModelTier } = require('../ai-models/models');
const { getLibDir } = require('../servicePathConfig');
const { updateImageTitle, updateImageMetaData } = require('../image-library/imageLibrary');
const { generateImageMetaData, stopGeneratingImageMetadata } = require('./generateImageMetaData');
const timeout = require('../service-utils/timeout');
const { addPendingProcessing } = require('../../main/activityController');
const mediaTypes = require('../../constants/mediaTypes');
const { logLibraryError } = require('../logs/logService');

// this is very similar to generateVideometadata.
let batchDescProcess = {
    status: 'idle', // 'idle', 'processing', 'complete', 'Stopping', 'stopped'
    progress: {
        currentIndex: 0,
        totalItems: 0,
        currentImageId: '',
        message: '',
    },
    error: null,
    batchMediaType: mediaTypes.IMAGE,
};

let BATCH_PROCESS_BREATHER_INTERVAL = 100;
let batchProcessCommand = null;

const __processImageMetaData = async (imageId, modelTier) => {
    const imageDetails = getImageDetailsById(imageId);
    const fullImagePath = path.join(getLibDir(), imageDetails.path);

    const existingTitle = typeof imageDetails?.title === 'string' ? imageDetails.title.trim() : '';
    const shouldGenerateTitle = existingTitle === '' || existingTitle === 'Untitled';

    const imageMetaData = await generateImageMetaData(imageId, fullImagePath, modelTier, shouldGenerateTitle);

    if (imageMetaData.description.length > 5 && imageMetaData.embedding) {
        try {
            updateImageMetaData(imageId, imageMetaData.description, imageMetaData.embedding);
        } catch (e) {
            logLibraryError(`processImageMetaData: Error updating image metadata: ${e}`);
        }
    }
    if (shouldGenerateTitle && imageMetaData.title.trim() !== '') {
        try {
            updateImageTitle(imageId, imageMetaData.title);
        } catch (e) {}
    }
};

const _checkForAllPendingProcess = () => {
    if (batchDescProcess.status === 'processing') {
        addPendingProcessing('imageMetadataIndexing');
        stopImageMetaDataBatchGeneration();
    }
};

const isStopRequested = () => {
    return batchProcessCommand === 'STOP_BATCH_PROCESSING';
};

const markBatchProcessStopped = () => {
    batchDescProcess.status = 'stopped';
    batchDescProcess.progress.message = 'Processing stopped.';
    streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
};

const startImageMetaDataBatchGeneration = async () => {
    batchDescProcess.status = 'processing';
    try {
        const pendingImageIds = getImageListWithoutDescription();
        // check if all images are done before we start the processing
        if (pendingImageIds.length === 0) {
            batchDescProcess.status = 'complete';
            batchDescProcess.progress.message = 'All media processed.';
            streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
            return;
        }

        serviceEventBus.subscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
        batchDescProcess.progress.currentIndex = 1;
        batchDescProcess.progress.totalItems = pendingImageIds.length;
        batchDescProcess.progress.currentImageId = '';
        batchDescProcess.error = null;
        batchDescProcess.progress.message = 'Image processing started.';

        batchProcessCommand = 'START_BATCH_PROCESSING';

        streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
        const modelTier = getModelTier();

        for (const imageId of pendingImageIds) {
            if (isStopRequested()) {
                markBatchProcessStopped();
                break;
            }

            batchDescProcess.progress.currentImageId = imageId;

            await __processImageMetaData(imageId, modelTier);

            if (isStopRequested()) {
                markBatchProcessStopped();
                break;
            }

            batchDescProcess.progress.message = `${batchDescProcess.progress.currentIndex} of ${batchDescProcess.progress.totalItems} processed.`;
            streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
            batchDescProcess.progress.currentIndex++;
            await timeout(BATCH_PROCESS_BREATHER_INTERVAL);
        }
        if (batchDescProcess.status !== 'stopped') {
            batchDescProcess.status = 'complete';
            streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
        }
    } catch (e) {
        if (isStopRequested()) {
            markBatchProcessStopped();
        } else {
            batchDescProcess.status = 'error';
            batchDescProcess.error = e.message;
            streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
        }
    } finally {
        serviceEventBus.unsubscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
    }
};

const stopImageMetaDataBatchGeneration = async () => {
    batchProcessCommand = 'STOP_BATCH_PROCESSING';

    batchDescProcess.status = 'stopping';
    batchDescProcess.progress.message = 'Stopping current image processing...';

    streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);

    if (batchDescProcess.progress.currentImageId) {
        try {
            await stopGeneratingImageMetadata(batchDescProcess.progress.currentImageId);
        } catch (_) {
            logLibraryError('Failed to stop generating metadata for image:', batchDescProcess.progress.currentImageId);
        }
    }

    serviceEventBus.unsubscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
};
const getBatchGenStatus = () => batchDescProcess.status;

module.exports = {
    stopImageMetaDataBatchGeneration,
    startImageMetaDataBatchGeneration,
    getBatchGenStatus,
};
