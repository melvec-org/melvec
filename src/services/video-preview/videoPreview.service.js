const fse = require('fs-extra');
const { respondSuccess, respondError, respondFailure } = require('../service-utils/sendToUI');
const { startPreviewBatchGeneration, stopPreviewBatchGeneration, getBatchPreviewStatus } = require('./batchGenerateVideoPreview');
const { clearAllPreviewStatuses, getVideoIdsWithoutPreview } = require('../database/videoLibraryDbService');
const { getPreviewDir } = require('../servicePathConfig');

const startBatchPreviewGenerationService = () => {
    try {
        const currentState = getBatchPreviewStatus();

        if (currentState.status === 'processing' || currentState.status === 'stopping') {
            return respondFailure('Batch video preview generation is already in progress.', currentState);
        }

        startPreviewBatchGeneration();
        return respondSuccess('Batch video preview generation started successfully.');
    } catch (e) {
        return respondError(`Failed to start batch video preview generation: ${e.message}`);
    }
};

const stopBatchPreviewGenerationService = () => {
    try {
        stopPreviewBatchGeneration();
        return respondSuccess('Batch video preview generation stopped.');
    } catch (e) {
        return respondError(`Failed to stop batch video preview generation: ${e.message}`);
    }
};

const getBatchPreviewStatusService = () => {
    try {
        const status = getBatchPreviewStatus();
        return respondSuccess('Batch preview status fetched.', status);
    } catch (e) {
        return respondError(`Failed to get batch preview status: ${e.message}`);
    }
};

const getPendingPreviewCountService = () => {
    try {
        const count = getVideoIdsWithoutPreview().length;
        return respondSuccess('Pending preview count fetched.', { count });
    } catch (e) {
        return respondError(`Failed to get pending preview count: ${e.message}`);
    }
};

const clearAllPreviewsService = () => {
    try {
        const previewDir = getPreviewDir();
        if (fse.existsSync(previewDir)) {
            fse.emptyDirSync(previewDir);
        }
        clearAllPreviewStatuses();
        return respondSuccess('All video previews cleared successfully.');
    } catch (e) {
        return respondError(`Failed to clear video previews: ${e.message}`);
    }
};

module.exports = {
    startBatchPreviewGenerationService,
    stopBatchPreviewGenerationService,
    getPendingPreviewCountService,
    clearAllPreviewsService,
};
