const path = require('path');
const interServiceEvents = require('../../events/interServiceEvents');
const serviceEventBus = require('../service-utils/serviceEventBus');
const { addPendingProcessing, removePendingProcessing } = require('../../main/activityController');
const timeout = require('../service-utils/timeout');
const mainThreadEvents = require('../../events/mainThreadEvents');
const { getDescriptionById, setGeneratedVideoMetaData } = require('../database/metaDataDbService');
const { streamToUI } = require('../service-utils/sendToUI');
const { getModelTier } = require('../ai-models/models');

const { generateVideoMetadata, stopGeneratingVideoMetadata } = require('./generateVideoMetaData');
const { getLibDir } = require('../servicePathConfig');
const { udpateVideoTitle, updateVideoCategory } = require('../video-library/videoLibrary');
const mediaTypes = require('../../constants/mediaTypes');
const { getBasicVideoDetailsById } = require('../video-library/videoLibrary.service');

let batchDescProcess = {
    status: 'idle', // 'idle', 'processing', 'complete', 'Stopping', 'stopped'
    progress: {
        currentIndex: 0,
        totalItems: 0,
        currentVideoId: '',
        message: '',
    },
    error: null,
    batchMediaType: mediaTypes.VIDEO,
};

let BATCH_PROCESS_BREATHER_INTERVAL = 100;
let batchProcessCommand = null;

const __processVideoMetaData = async (videoId, modelTier) => {
    const videoDetails = getBasicVideoDetailsById(videoId);
    const fullVideoPath = path.join(getLibDir(), videoDetails.path);

    const existingTitle = typeof videoDetails?.title === 'string' ? videoDetails.title.trim() : '';
    const shouldGenerateTitle = existingTitle === '' || existingTitle === 'Untitled';

    const videoMetaData = await generateVideoMetadata(videoId, fullVideoPath, modelTier, shouldGenerateTitle);
    if (!videoMetaData) return; // skipped (e.g. audio-only file with no video stream)

    if (videoMetaData.description.length > 5) {
        setGeneratedVideoMetaData(videoId, videoMetaData, 'ai');
    }

    if (shouldGenerateTitle && videoMetaData.generatedTitle.trim() !== '') {
        udpateVideoTitle(videoId, videoMetaData.generatedTitle);
    }

    if (videoMetaData.categoryId !== null && videoDetails.categoryId === null) {
        updateVideoCategory(videoId, videoMetaData.categoryId);
    }
};

const _checkForAllPendingProcess = () => {
    if (batchDescProcess.status === 'processing') {
        addPendingProcessing('relatedVideosIndexing');
        stopMetaDataBatchGeneration();
    }
};

const isStopRequested = () => {
    return batchProcessCommand === 'STOP_BATCH_PROCESSING';
};

const markBatchProcessStopped = () => {
    batchDescProcess.status = 'stopped';
    batchDescProcess.progress.message = 'Processing stopped.';
    streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
    removePendingProcessing('relatedVideosIndexing');
};

const startMetaDataBatchGeneration = async (videoIds = []) => {
    batchDescProcess.status = 'processing';

    try {
        const pendingVideoIds = videoIds.filter((videoId) => {
            const desc = getDescriptionById(videoId);
            return !desc || desc.trim() === '';
        });

        if (pendingVideoIds.length === 0) {
            batchDescProcess.status = 'complete';
            batchDescProcess.progress.message = 'All videos are processed';
            streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
            return;
        }

        serviceEventBus.subscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
        batchDescProcess.progress.currentIndex = 1;
        batchDescProcess.progress.totalItems = pendingVideoIds.length;
        batchDescProcess.progress.currentVideoId = '';
        batchDescProcess.error = null;
        batchDescProcess.progress.message = 'Gathering all media data and loading AI engines.';
        batchProcessCommand = 'START_BATCH_PROCESSING';

        streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
        const modelTier = getModelTier();

        for (const videoId of pendingVideoIds) {
            if (isStopRequested()) {
                markBatchProcessStopped();
                break;
            }

            batchDescProcess.progress.currentVideoId = videoId;
            await __processVideoMetaData(videoId, modelTier);

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

const stopMetaDataBatchGeneration = async () => {
    batchProcessCommand = 'STOP_BATCH_PROCESSING';

    batchDescProcess.status = 'stopping';
    batchDescProcess.progress.message = 'Stopping current video processing...';

    streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);

    if (batchDescProcess.progress.currentVideoId) {
        try {
            await stopGeneratingVideoMetadata(batchDescProcess.progress.currentVideoId);
        } catch (e) {
            logLibraryError(
                `Failed to stop generating video metadata for videoId: ${batchDescProcess.progress.currentVideoId}. Error details: ${e.message}`,
            );
        }
    }

    removePendingProcessing('relatedVideosIndexing');
    serviceEventBus.unsubscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
};
const getBatchGenStatus = () => batchDescProcess.status;
module.exports = {
    startMetaDataBatchGeneration,
    stopMetaDataBatchGeneration,
    getBatchGenStatus,
};
