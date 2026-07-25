const serviceMethods = require('../../../constants/serviceMethods');
const {
    startBatchPreviewGenerationService,
    stopBatchPreviewGenerationService,
    getPendingPreviewCountService,
    clearAllPreviewsService,
} = require('../../video-preview/videoPreview.service');

const videoPreviewServiceHandlers = [
    [serviceMethods.VIDEO_PREVIEW_START_BATCH_GENERATION, async () => startBatchPreviewGenerationService()],
    [serviceMethods.VIDEO_PREVIEW_STOP_BATCH_GENERATION, async () => stopBatchPreviewGenerationService()],
    [serviceMethods.VIDEO_PREVIEW_GET_PENDING_COUNT, async () => getPendingPreviewCountService()],
    [serviceMethods.VIDEO_PREVIEW_CLEAR_ALL, async () => clearAllPreviewsService()],
];

module.exports = {
    videoPreviewServiceHandlers,
};
