const path = require('path');
const interServiceEvents = require('../../events/interServiceEvents');
const serviceEventBus = require('../service-utils/serviceEventBus');
const { addPendingProcessing, removePendingProcessing } = require('../../main/activityController');
const timeout = require('../service-utils/timeout');
const mainThreadEvents = require('../../events/mainThreadEvents');
const { streamToUI } = require('../service-utils/sendToUI');
const { getVideoDetailsById, updateHasPreviewStatus } = require('../database/videoLibraryDbService');
const { getVideoIdsWithoutPreview } = require('../video-library/videoLibrary');
const { generateVideoPreview } = require('../service-utils/generateVideoPreview');
const { getLibDir, getPreviewDir } = require('../servicePathConfig');
const { logLibraryError } = require('../logs/logService');

const BATCH_PROCESS_BREATHER_INTERVAL = 100;
const PENDING_PROCESS_KEY = 'videoPreviewGeneration';

let batchPreviewProcess = {
    status: 'idle',
    progress: {
        currentIndex: 0,
        totalItems: 0,
        currentVideoId: '',
        message: '',
    },
    error: null,
};

let batchProcessCommand = null;

const isStopRequested = () => batchProcessCommand === 'STOP_BATCH_PROCESSING';

const _streamUpdate = () => streamToUI(mainThreadEvents.ON_BATCH_PREVIEW_PROCESS, batchPreviewProcess);

const markBatchProcessStopped = () => {
    batchPreviewProcess.status = 'stopped';
    batchPreviewProcess.progress.message = 'Processing stopped.';
    _streamUpdate();
    removePendingProcessing(PENDING_PROCESS_KEY);
};

const _checkForAllPendingProcess = () => {
    if (batchPreviewProcess.status === 'processing') {
        addPendingProcessing(PENDING_PROCESS_KEY);
        stopPreviewBatchGeneration();
    }
};

const __processVideoPreview = async (videoId) => {
    const videoDetails = getVideoDetailsById(videoId);
    if (!videoDetails) return;

    const fullVideoPath = path.join(getLibDir(), videoDetails.path);
    const previewFolder = getPreviewDir();
    try {
        const previewPath = await generateVideoPreview({
            videoPath: fullVideoPath,
            previewFolder,
            videoId,
        });

        if (previewPath) {
            updateHasPreviewStatus(videoId, true);
        }
    } catch (err) {
        console.error(`Failed to generate preview for video ${videoId}: ${err.message}`);
        logLibraryError(`Failed to generate preview for video ${videoId}: ${err.message}`);
    }
};

const startPreviewBatchGeneration = async () => {
    batchPreviewProcess.status = 'processing';

    try {
        const pendingVideoIds = getVideoIdsWithoutPreview();

        if (pendingVideoIds.length === 0) {
            batchPreviewProcess.status = 'complete';
            batchPreviewProcess.progress.message = 'All videos already have previews.';
            _streamUpdate();
            return;
        }

        serviceEventBus.subscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);

        batchPreviewProcess.progress.currentIndex = 1;
        batchPreviewProcess.progress.totalItems = pendingVideoIds.length;
        batchPreviewProcess.progress.currentVideoId = '';
        batchPreviewProcess.error = null;
        batchPreviewProcess.progress.message = 'Starting video preview generation.';
        batchProcessCommand = 'START_BATCH_PROCESSING';

        _streamUpdate();

        for (const videoId of pendingVideoIds) {
            if (isStopRequested()) {
                markBatchProcessStopped();
                break;
            }

            batchPreviewProcess.progress.currentVideoId = videoId;

            await __processVideoPreview(videoId);

            if (isStopRequested()) {
                markBatchProcessStopped();
                break;
            }

            batchPreviewProcess.progress.message = `${batchPreviewProcess.progress.currentIndex} of ${batchPreviewProcess.progress.totalItems} processed.`;
            _streamUpdate();
            batchPreviewProcess.progress.currentIndex++;
            await timeout(BATCH_PROCESS_BREATHER_INTERVAL);
        }

        if (batchPreviewProcess.status !== 'stopped') {
            batchPreviewProcess.status = 'complete';
            batchPreviewProcess.progress.message = 'All video previews generated.';
            _streamUpdate();
        }
    } catch (e) {
        if (isStopRequested()) {
            markBatchProcessStopped();
        } else {
            batchPreviewProcess.status = 'error';
            batchPreviewProcess.error = e.message;
            _streamUpdate();
        }
    } finally {
        serviceEventBus.unsubscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
    }
};

const stopPreviewBatchGeneration = () => {
    batchProcessCommand = 'STOP_BATCH_PROCESSING';
    batchPreviewProcess.status = 'stopping';
    batchPreviewProcess.progress.message = 'Stopping video preview generation...';
    _streamUpdate();
    removePendingProcessing(PENDING_PROCESS_KEY);
    serviceEventBus.unsubscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
};

const getBatchPreviewStatus = () => batchPreviewProcess;

module.exports = {
    startPreviewBatchGeneration,
    stopPreviewBatchGeneration,
    getBatchPreviewStatus,
};
