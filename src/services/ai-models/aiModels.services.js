const responseStatus = require('../../constants/responseStatus');
const mainThreadEvents = require('../../events/mainThreadEvents');
const { respondSuccess, respondError, streamToUI } = require('../service-utils/sendToUI');
const {
    checkForModels,
    downloadModels,
    cancelDownloadModels,
    pauseDownloadModels,
    resumeDownloadModels,
    deleteModels,
    importModelsFromLocalPath,
} = require('./models');

/**
 * Streams AI model download progress updates to the UI layer.
 *
 * Expected payload fields are produced by the model download pipeline and may
 * include current item progress, overall status, error details, download mode,
 * and additional notes.
 *
 * @param {Object} data - Download progress payload.
 * @param {Object|null} data.currentItem - Information about the file currently being downloaded.
 * @param {number} data.currentItem.index - Current file index in the download queue.
 * @param {number} data.currentItem.total - Total number of files in the queue.
 * @param {number} [data.currentItem.percent] - Completion percentage for the current file.
 * @param {string} data.status - Overall download status.
 * @param {string|Error|undefined} [data.error] - Error details, if any.
 * @param {string} [data.downloadMode] - Indicates the type or tier of download being performed.
 * @param {string} [data.note] - Additional status note to send to the UI.
 * @returns {void}
 */
const downloadProgressTracker = (data) => {
    let currentItemStatus = '';
    if (data.currentItem !== null) {
        currentItemStatus = `Downloading ${data.currentItem.index} of ${data.currentItem.total} files | ${data.currentItem.percent || 0}% `;
    }

    if (data.status === responseStatus.SUCCESS) {
        currentItemStatus = `Download completed successfully. Please restart the app to apply changes.`;
    }

    streamToUI(mainThreadEvents.ON_AI_MODEL_DOWNLOAD, {
        overallStatus: data.status,
        error: data.error,
        currentItemStatus: currentItemStatus,
        downloadMode: data.downloadMode,
        note: data.note,
    });
};

/**
 * Starts downloading AI model files for the requested model tier.
 *
 * Progress updates are streamed asynchronously to the UI through
 * `downloadProgressTracker`.
 *
 * @param {string} modelTier - The model tier to download.
 * @returns {Object} Standard service response object.
 */
const downloadAIModelsService = (modelTier) => {
    try {
        downloadModels(modelTier, downloadProgressTracker);
        return respondSuccess('Started the download of AI models', modelTier);
    } catch (error) {
        return respondError(`Failed to download AI models: ${error.message}`);
    }
};
/**
 * Checks whether the required AI model files exist for a given model tier.
 *
 * @param {string} modelTier - The model tier to verify.
 * @returns {Object} Standard service response containing model file status.
 */
const checkForModelFilesService = (modelTier) => {
    try {
        const modelsFileStatus = checkForModels(modelTier);
        return respondSuccess('', modelsFileStatus);
    } catch (e) {
        return respondError('Some problem with checking models');
    }
};

/**
 * Cancels an in-progress AI model download.
 *
 * @returns {Object} Standard service response object.
 */
const cancelAIModelDownloadService = () => {
    cancelDownloadModels();
    return respondSuccess('cancelled the download of AI models');
};
/**
 * Pauses an in-progress AI model download.
 *
 * @returns {Object} Standard service response object.
 */
const pauseAIModelDownloadService = () => {
    pauseDownloadModels();
    return respondSuccess('paused the download of AI models');
};

/**
 * Resumes a paused AI model download.
 *
 * @returns {Object} Standard service response object.
 */
const resumeAIModelDownloadService = () => {
    resumeDownloadModels();
    return respondSuccess('resumed the download of AI models');
};

/**
 * Deletes downloaded AI model files for the specified model tier.
 *
 * @param {string} modelTier - The model tier whose files should be removed.
 * @returns {Promise<Object>} Standard service response object.
 */
const deleteModelFilesService = async (modelTier) => {
    try {
        await deleteModels(modelTier);

        return respondSuccess('Cleared the model files');
    } catch (error) {
        return respondError(`${error}`);
    }
};

const importModelsFromLocalPathService = async (localPath) => {
    try {
        await importModelsFromLocalPath(localPath);
        return respondSuccess('All files impported');
    } catch (error) {
        return respondError(`${error}`);
    }
};

module.exports = {
    downloadAIModelsService,
    cancelAIModelDownloadService,
    pauseAIModelDownloadService,
    resumeAIModelDownloadService,
    checkForModelFilesService,
    deleteModelFilesService,
    importModelsFromLocalPathService,
};
