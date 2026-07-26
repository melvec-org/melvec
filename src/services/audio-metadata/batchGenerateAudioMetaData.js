const path = require('path');
const interServiceEvents = require('../../events/interServiceEvents');
const mainThreadEvents = require('../../events/mainThreadEvents');
const { streamToUI } = require('../service-utils/sendToUI');
const serviceEventBus = require('../service-utils/serviceEventBus');
const { getAudioListWithoutDescription, getAudioDetailsById } = require('../database/audioLibraryDbService');
const { getModelTier } = require('../ai-models/models');
const { getLibDir } = require('../servicePathConfig');
const { updateAudioTitle, updateAudioMetaData } = require('../audio-library/audioLibrary');
const { generateAudioMetaData, stopGeneratingAudioMetadata } = require('./generateAudioMetaData');
const timeout = require('../service-utils/timeout');
const { addPendingProcessing } = require('../../main/activityController');
const mediaTypes = require('../../constants/mediaTypes');
const { logLibraryError } = require('../logs/logService');

let batchDescProcess = {
    status: 'idle',
    progress: {
        currentIndex: 0,
        totalItems: 0,
        currentAudioId: '',
        message: '',
    },
    error: null,
    batchMediaType: mediaTypes.AUDIO,
};

let BATCH_PROCESS_BREATHER_INTERVAL = 100;
let batchProcessCommand = null;

const __processAudioMetaData = async (audioId, modelTier) => {
    const audioDetails = getAudioDetailsById(audioId);
    const fullAudioPath = path.join(getLibDir(), audioDetails.path);

    const existingTitle = typeof audioDetails?.title === 'string' ? audioDetails.title.trim() : '';
    const shouldGenerateTitle = existingTitle === '' || existingTitle === 'Untitled';

    const audioMetaData = await generateAudioMetaData(audioId, fullAudioPath, modelTier, shouldGenerateTitle);

    if (audioMetaData.description.length > 5 && audioMetaData.embedding) {
        try {
            updateAudioMetaData(audioId, audioMetaData.description, audioMetaData.embedding);
        } catch (e) {
            logLibraryError(`processAudioMetaData: Error updating audio metadata: ${e}`);
        }
    }
    if (shouldGenerateTitle && audioMetaData.title.trim() !== '') {
        try {
            updateAudioTitle(audioId, audioMetaData.title);
        } catch (e) {}
    }
};

const _checkForAllPendingProcess = () => {
    if (batchDescProcess.status === 'processing') {
        addPendingProcessing('audioMetadataIndexing');
        stopAudioMetaDataBatchGeneration();
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

const startAudioMetaDataBatchGeneration = async () => {
    batchDescProcess.status = 'processing';
    try {
        const pendingAudioIds = getAudioListWithoutDescription();
        if (pendingAudioIds.length === 0) {
            batchDescProcess.status = 'complete';
            batchDescProcess.progress.message = 'All media processed.';
            streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
            return;
        }

        serviceEventBus.subscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
        batchDescProcess.progress.currentIndex = 1;
        batchDescProcess.progress.totalItems = pendingAudioIds.length;
        batchDescProcess.progress.currentAudioId = '';
        batchDescProcess.error = null;
        batchDescProcess.progress.message = 'Audio processing started.';

        batchProcessCommand = 'START_BATCH_PROCESSING';

        streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);
        const modelTier = getModelTier();

        for (const audioId of pendingAudioIds) {
            if (isStopRequested()) {
                markBatchProcessStopped();
                break;
            }

            batchDescProcess.progress.currentAudioId = audioId;

            await __processAudioMetaData(audioId, modelTier);

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

const stopAudioMetaDataBatchGeneration = async () => {
    batchProcessCommand = 'STOP_BATCH_PROCESSING';

    batchDescProcess.status = 'stopping';
    batchDescProcess.progress.message = 'Stopping current audio processing...';

    streamToUI(mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS, batchDescProcess);

    if (batchDescProcess.progress.currentAudioId) {
        try {
            await stopGeneratingAudioMetadata(batchDescProcess.progress.currentAudioId);
        } catch (_) {
            logLibraryError('Failed to stop generating metadata for audio:', batchDescProcess.progress.currentAudioId);
        }
    }

    serviceEventBus.unsubscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
};
const getBatchGenStatus = () => batchDescProcess;

module.exports = {
    stopAudioMetaDataBatchGeneration,
    startAudioMetaDataBatchGeneration,
    getBatchGenStatus,
};
