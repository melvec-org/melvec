const path = require('path');
const interServiceEvents = require('../../events/interServiceEvents');
const mainThreadEvents = require('../../events/mainThreadEvents');
const serviceEventBus = require('../service-utils/serviceEventBus');
const { addPendingProcessing, removePendingProcessing } = require('../../main/activityController');
const timeout = require('../service-utils/timeout');
const { streamToUI } = require('../service-utils/sendToUI');
const { getLibDir } = require('../servicePathConfig');
const { logLibraryError } = require('../logs/logService');
const { extractFaces } = require('../service-utils/extractFaces');
const { addFace, getPendingSubjectCandidateFaces } = require('./subjectsDbService');
const { assignFaceToCandidateCluster } = require('./subjectCandidateClustering');
const {
    getVideoDetailsById,
    getAllPendingFaceExtractionVideoList,
    updateFaceExtractionStatus: updateVideoFaceExtractionStatus,
} = require('../video-library/videoLibraryDbService');
const {
    getImageDetailsById,
    getAllPendingFaceExtractionImageList,
    updateFaceExtractionStatus: updateImageFaceExtractionStatus,
} = require('../image-library/imageLibraryDbService');
const mediaTypes = require('../../constants/mediaTypes');
const faceExtractionStatus = require('../../constants/faceExtractionStatus');

const BATCH_PROCESS_BREATHER_INTERVAL = 100;
const PENDING_PROCESS_KEY = 'faceBatchProcessing';

let batchProcessCommand = null;

const processFlags = faceExtractionStatus;

const batchFaceProcessingStatus = {
    status: 'idle',
    progress: {
        currentIndex: 0,
        totalItems: 0,
        failedCount: 0,
        currentMediaId: '',
        message: '',
    },
    error: null,
    currentMediaStatus: {
        status: processFlags.NOT_STARTED,
    },
};

const isStopRequested = () => batchProcessCommand === 'STOP_BATCH_PROCESSING';

const _streamUpdate = () => streamToUI(mainThreadEvents.ON_BATCH_FACE_EXTRACTION_PROCESS, batchFaceProcessingStatus);

const markBatchProcessStopped = () => {
    batchFaceProcessingStatus.status = 'stopped';
    batchFaceProcessingStatus.progress.message = 'Face processing stopped.';
    _streamUpdate();
    removePendingProcessing(PENDING_PROCESS_KEY);
};

const _checkForAllPendingProcess = () => {
    if (batchFaceProcessingStatus.status === 'processing') {
        addPendingProcessing(PENDING_PROCESS_KEY);
        stopBatchFaceProcessing();
    }
};

const buildMediaPath = (mediaDetails) => {
    if (!mediaDetails?.path) {
        return '';
    }

    return path.join(getLibDir(), mediaDetails.path);
};

const persistExtractedFaces = (faceData, mediaType) => {
    const candidateFaces = getPendingSubjectCandidateFaces();

    for (const { mediaId: faceId, embedding, confidence } of faceData.faces || []) {
        addFace(faceId, faceData.mediaId, confidence, embedding);

        const result = assignFaceToCandidateCluster({ id: faceId, embedding, confidence }, mediaType, faceData.mediaId, candidateFaces);
        candidateFaces.push({
            candidateId: result.candidateId,
            faceId,
            embedding,
            confidence,
        });
    }
};

const updateMediaFaceExtractionStatus = (mediaType, mediaId, status) => {
    if (mediaType === mediaTypes.VIDEO) {
        return updateVideoFaceExtractionStatus(mediaId, status);
    }

    if (mediaType === mediaTypes.IMAGE) {
        return updateImageFaceExtractionStatus(mediaId, status);
    }

    throw new Error(`Unsupported media type for face extraction: ${mediaType}`);
};

const getPendingMediaForFaceExtraction = () => {
    const pendingVideoIds = getAllPendingFaceExtractionVideoList().map((mediaId) => ({
        mediaId,
        mediaType: mediaTypes.VIDEO,
    }));

    const pendingImageIds = getAllPendingFaceExtractionImageList().map((mediaId) => ({
        mediaId,
        mediaType: mediaTypes.IMAGE,
    }));

    return [...pendingVideoIds, ...pendingImageIds];
};

const __processMediaFaces = async ({ mediaId, mediaType }) => {
    const mediaDetails = mediaType === mediaTypes.VIDEO ? getVideoDetailsById(mediaId) : getImageDetailsById(mediaId);

    if (!mediaDetails) {
        throw new Error(`Media not found: ${mediaId}`);
    }

    const mediaPath = buildMediaPath(mediaDetails);

    if (!mediaPath) {
        throw new Error(`Media path not available: ${mediaId}`);
    }

    updateMediaFaceExtractionStatus(mediaType, mediaId, processFlags.PROCESSING);

    const faceData = await extractFaces(mediaPath, mediaType, mediaId);

    if (faceData.detectedFaceCount > 0) {
        persistExtractedFaces(faceData, mediaType);
        updateMediaFaceExtractionStatus(mediaType, mediaId, processFlags.COMPLETED_FACE_DETECTED);
        return processFlags.COMPLETED_FACE_DETECTED;
    }

    updateMediaFaceExtractionStatus(mediaType, mediaId, processFlags.COMPLETED_NO_FACE_DETECTED);
    return processFlags.COMPLETED_NO_FACE_DETECTED;
};

const startBatchFaceProcessing = async () => {
    batchFaceProcessingStatus.status = 'processing';

    try {
        const pendingMedia = getPendingMediaForFaceExtraction();

        if (!Array.isArray(pendingMedia) || pendingMedia.length === 0) {
            batchFaceProcessingStatus.status = 'complete';
            batchFaceProcessingStatus.progress.message = 'No pending media for face processing.';
            _streamUpdate();
            return;
        }

        serviceEventBus.subscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);

        batchFaceProcessingStatus.progress.currentIndex = 1;
        batchFaceProcessingStatus.progress.totalItems = pendingMedia.length;
        batchFaceProcessingStatus.progress.failedCount = 0;
        batchFaceProcessingStatus.progress.currentMediaId = '';
        batchFaceProcessingStatus.progress.message = 'Starting face extraction batch.';
        batchFaceProcessingStatus.error = null;
        batchFaceProcessingStatus.currentMediaStatus = {
            status: processFlags.NOT_STARTED,
        };
        batchProcessCommand = 'START_BATCH_PROCESSING';

        _streamUpdate();

        for (const media of pendingMedia) {
            if (isStopRequested()) {
                markBatchProcessStopped();
                break;
            }

            batchFaceProcessingStatus.progress.currentMediaId = media.mediaId;
            batchFaceProcessingStatus.currentMediaStatus = {
                status: processFlags.PROCESSING,
            };
            _streamUpdate();

            try {
                const status = await __processMediaFaces(media);
                batchFaceProcessingStatus.currentMediaStatus = {
                    status,
                };
            } catch (error) {
                console.log(error);
                batchFaceProcessingStatus.progress.failedCount++;
                batchFaceProcessingStatus.currentMediaStatus = {
                    status: processFlags.FAILED,
                    error: error.message,
                };
                updateMediaFaceExtractionStatus(media.mediaType, media.mediaId, processFlags.FAILED);
                logLibraryError(`Face extraction failed for ${media.mediaType} ${media.mediaId}: ${error.message}`);
            }

            if (isStopRequested()) {
                markBatchProcessStopped();
                break;
            }

            batchFaceProcessingStatus.progress.message =
                `${batchFaceProcessingStatus.progress.currentIndex} of ${batchFaceProcessingStatus.progress.totalItems} media processed.` +
                (batchFaceProcessingStatus.progress.failedCount > 0
                    ? ` ${batchFaceProcessingStatus.progress.failedCount} failed.`
                    : '');
            _streamUpdate();
            batchFaceProcessingStatus.progress.currentIndex++;
            await timeout(BATCH_PROCESS_BREATHER_INTERVAL);
        }

        if (batchFaceProcessingStatus.status !== 'stopped') {
            batchFaceProcessingStatus.status = 'complete';
            batchFaceProcessingStatus.progress.message =
                'Face extraction batch completed.' +
                (batchFaceProcessingStatus.progress.failedCount > 0
                    ? ` ${batchFaceProcessingStatus.progress.failedCount} failed.`
                    : '');
            _streamUpdate();
        }
    } catch (error) {
        if (isStopRequested()) {
            markBatchProcessStopped();
        } else {
            batchFaceProcessingStatus.status = 'error';
            batchFaceProcessingStatus.error = error.message;
            _streamUpdate();
        }
    } finally {
        serviceEventBus.unsubscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
        removePendingProcessing(PENDING_PROCESS_KEY);
    }
};

const stopBatchFaceProcessing = () => {
    batchProcessCommand = 'STOP_BATCH_PROCESSING';
    batchFaceProcessingStatus.status = 'stopping';
    batchFaceProcessingStatus.progress.message = 'Stopping face extraction batch...';
    _streamUpdate();
    removePendingProcessing(PENDING_PROCESS_KEY);
    serviceEventBus.unsubscribe(interServiceEvents.CLOSE_APP_REQUEST, _checkForAllPendingProcess);
};

const getBatchFaceProcessingStatus = () => batchFaceProcessingStatus;

module.exports = {
    startBatchFaceProcessing,
    stopBatchFaceProcessing,
    getBatchFaceProcessingStatus,
    getPendingMediaForFaceExtraction,
};
