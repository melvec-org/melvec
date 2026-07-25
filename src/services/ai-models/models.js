const { app } = require('electron');
const path = require('path');
const { aiConfig } = require('../../configs/aiConfig');
const { doesDirectoryExist, removeFile, doesFileExist } = require('../service-utils/fileUtils');
const userPreferenceStore = require('../../main/userPreferenceStore');
const fs = require('fs');
const fsp = fs.promises;
const dirTree = require('directory-tree');

const { isDev } = require('../service-utils/env');
const { DownloadQueue } = require('../service-utils/downloadFile');
const {
    downloadViaChromium,
    getDefaultDownloadWebContents,
    cancelChromiumDownload,
} = require('../service-utils/registerDownloadsHandlers');
const { logSystemError } = require('../logs/logService');
const aiModelsErrors = require('./aiModels.errors');

/**
 * Returns the list of configured AI model tiers from the application config.
 *
 * @returns {string[]} Available model tier keys.
 */
const getAvailableModelTiers = () => Object.keys(aiConfig.models);

let downloadQInstance = null;
let activeChromiumFallbackUrl = null;

/**
 * Tracks the latest known AI model download state.
 *
 * Status values may include:
 * - idle
 * - downloading
 * - paused
 * - cancelled
 * - success
 * - error
 *
 * @type {{
 *   status: string,
 *   overall: {
 *     receivedBytes: number,
 *     totalBytes: number,
 *     percent: number
 *   },
 *   currentItem: null | {
 *     index?: number|null,
 *     total?: number|null,
 *     url?: string,
 *     destinationPath?: string,
 *     receivedBytes?: number,
 *     totalBytes?: number,
 *     percent?: number|null,
 *     status?: string
 *   },
 *   error: string|null,
 *   downloadMode?: string,
 *   note?: string
 * }}
 */
let lastDownloadProgress = {
    status: 'idle',
    overall: { receivedBytes: 0, totalBytes: 0, percent: 0 },
    currentItem: null,
    error: null,
};

/**
 * Returns the currently selected model tier from user preferences.
 * Falls back to the first available configured tier if the stored preference
 * is missing or invalid.
 *
 * @returns {string} Active model tier key.
 */
const getModelTier = () => {
    const pref = userPreferenceStore.get('ai')?.modelTier;
    return pref && aiConfig.models[pref] ? pref : getAvailableModelTiers()[0];
};
/**
 * Validates whether a given model tier exists in the AI config.
 *
 * @param {string} modelTier - Model tier key to validate.
 * @throws {Error} Throws if the model tier is missing, invalid, or not configured.
 * @returns {void}
 */
const assertValidTier = (modelTier) => {
    if (!modelTier || typeof modelTier !== 'string' || !aiConfig.models[modelTier]) {
        throw new Error(`Model tier does not exist: ${modelTier}`);
    }
};

/**
 * Cache of resolved model directories keyed by model tier.
 *
 * @type {Object.<string, string>}
 */
const modelsDirByTier = {};

/**
 * Returns the expected file names for a given model tier.
 *
 * @param {string} modelTier - Model tier key.
 * @returns {string[]} List of expected model file names.
 */
const getModelFilesList = (modelTier) => {
    const modelConfig = aiConfig.models[modelTier];
    const modelFiles = [
        modelConfig.whisper.fileName,
        modelConfig.slmModel.fileName,
        modelConfig.slmProjector.fileName,
        modelConfig.embeddingModel.fileName,
    ];
    return modelFiles;
};

/**
 * Checks whether all required model files exist for the provided tier.
 *
 * If one or more files are missing and a download is currently active, the
 * returned status will indicate that a download is in progress.
 *
 * @param {string} modelTier - Model tier key to check.
 * @returns {{status: string, message: string}} File availability status.
 */
const checkForModels = (modelTier) => {
    assertValidTier(modelTier);

    const filesToCheck = getModelFilesList(modelTier);
    const unavailableFiles = [];

    for (const file of filesToCheck) {
        const fullPath = path.join(getModelsDir(modelTier), file);

        if (!doesFileExist(fullPath)) {
            unavailableFiles.push(fullPath);
        }
    }

    if (unavailableFiles.length > 0) {
        if (lastDownloadProgress.status === 'downloading') {
            return {
                status: 'DOWNLOADING',
                message: `Missing files: ${unavailableFiles}`,
            };
        } else {
            return {
                status: 'MISSING',
                message: `Missing files: ${unavailableFiles}`,
            };
        }
    } else {
        return {
            status: 'OK',
            message: 'All required AI models are available.',
        };
    }
};

/**
 * Resolves the local directory where model files for a given tier are stored.
 *
 * In development mode, model files are resolved relative to the project root.
 * In production, they are stored under Electron's userData path.
 *
 * The resolved path is cached by tier for reuse.
 *
 * @param {string} modelTier - Model tier key.
 * @returns {string} Absolute directory path for the model tier.
 */
const getModelsDir = (modelTier) => {
    assertValidTier(modelTier);

    if (modelsDirByTier[modelTier]) return modelsDirByTier[modelTier];

    if (isDev()) {
        modelsDirByTier[modelTier] = path.join(__dirname, '..', '..', '..', 'models', modelTier);
        return modelsDirByTier[modelTier];
    }

    const base = app.getPath('userData');
    modelsDirByTier[modelTier] = path.join(base, 'models', modelTier);

    fsp.mkdir(modelsDirByTier[modelTier], { recursive: true }).catch((err) => console.error('Failed to create models dir', err));
    return modelsDirByTier[modelTier];
};

const availableModels = [];

const checkModelAvailability = (modelPath) => {
    if (availableModels.includes(modelPath)) return true;

    if (fs.existsSync(modelPath)) {
        availableModels.push(modelPath);
        return true;
    } else {
        logSystemError(`${aiModelsErrors.AI_MODEL_NOT_FOUND}: ${modelPath}`);
        throw new Error(aiModelsErrors.AI_MODEL_NOT_FOUND);
    }
};

/**
 * Returns the absolute path for a specific model file from the currently
 * selected model tier.
 *
 * @param {string} modelKey - Model config key, such as `whisper`, `slmModel`, `slmProjector`, or `embeddingModel`.
 * @returns {string|null} Absolute file path if available, otherwise null.
 */
const getModelPath = (modelKey) => {
    const selectedModelType = getModelTier();
    assertValidTier(selectedModelType);

    const modelConfig = aiConfig.models[selectedModelType]?.[modelKey];

    if (!modelConfig?.fileName) {
        console.error(`No model found for ${modelKey} in ${selectedModelType} tier`);
        return null;
    }
    const finalPath = path.join(getModelsDir(selectedModelType), modelConfig.fileName);
    checkModelAvailability(finalPath);

    return finalPath;
};

/**
 * Deletes all configured model files for the specified tier.
 *
 * Missing files are ignored and treated as already deleted.
 *
 * @param {string} modelTier - Model tier key whose files should be deleted.
 * @returns {Promise<boolean>} Resolves to true when deletion completes successfully.
 */
const deleteModels = async (modelTier) => {
    const modelDir = getModelsDir(modelTier);

    const fileChecks = getModelFilesList(modelTier).map((item) => path.join(modelDir, item));

    for (const file of fileChecks) {
        try {
            await fs.promises.unlink(file);
        } catch (err) {
            if (err && err.code === 'ENOENT') continue;

            throw new Error(`Failed to delete model file ${file}: ${err?.message || err}`);
        }
    }
    return true;
};

/**
 * Removes incomplete partial download files from the given model directory.
 *
 * This cleanup targets files with the `.part` extension generated during
 * interrupted or unfinished downloads.
 *
 * @param {string} modelDir - Absolute model directory path.
 * @returns {Promise<boolean|{status: string, removed: Array}>} Cleanup result.
 */
const cleanupUncompletedDownloads = async (modelDir) => {
    try {
        if (!modelDir) {
            throw new Error('modelDir is required');
        }

        const exists = doesDirectoryExist(modelDir);
        if (!exists) {
            throw new Error('modelDir path not found');
        }

        const tree = dirTree(modelDir, { attributes: ['type'], extensions: /\.part$/ });

        let files = [];

        if (tree !== null) {
            const getFilesAndCollections = (directory) => {
                let filesArray = [];

                const filterData = (directory) => {
                    for (let i = 0; i < directory.children.length; i++) {
                        const item = directory.children[i];

                        if (item.type === 'directory') {
                            filterData(item);
                        } else {
                            delete item.type;
                            filesArray.push(item);
                        }
                    }
                };

                filterData(directory);
                return {
                    filesArray,
                };
            };
            const fileTree = getFilesAndCollections(tree);

            files = fileTree.filesArray;
        }

        if (files.length === 0) {
            return { status: 'success', removed: [] };
        }

        for (let i = 0; i < files.length; i++) {
            await removeFile(files[i].path);
        }
        return true;
    } catch (e) {
        console.error(`Failed to cleanup uncompleted downloads for modelTier`, e);
    }
};

/**
 * Starts downloading the required model files for a given tier.
 *
 * Existing files are skipped automatically. Progress updates are reported
 * through the supplied callback. If direct download fails due to certificate
 * issues, a Chromium-based fallback download may be used.
 *
 * @param {string} modelTier - Model tier key to download. Falls back to the selected tier if not provided.
 * @param {Function} onProgress - Progress callback invoked with the latest download state.
 * @returns {Promise<Object|null>} Download queue instance, or null if all files already exist.
 */
const downloadModels = async (modelTier, onProgress) => {
    modelTier = modelTier || getModelTier();

    const cfg = aiConfig.models[modelTier];

    const baseDir = getModelsDir(modelTier);

    const items = [
        { url: cfg.whisper.downloadURL, destinationPath: path.join(baseDir, cfg.whisper.fileName) },
        { url: cfg.slmModel.downloadURL, destinationPath: path.join(baseDir, cfg.slmModel.fileName) },
        { url: cfg.slmProjector.downloadURL, destinationPath: path.join(baseDir, cfg.slmProjector.fileName) },
        { url: cfg.embeddingModel.downloadURL, destinationPath: path.join(baseDir, cfg.embeddingModel.fileName) },
    ];

    const pendingItems = items.filter((item) => {
        const exists = doesFileExist(item.destinationPath);

        return !exists;
    });

    if (pendingItems.length === 0) {
        lastDownloadProgress = {
            status: 'success',
            overall: { receivedBytes: 0, totalBytes: 0, percent: 100 },
            currentItem: null,
            error: null,
        };

        if (typeof onProgress === 'function') onProgress(lastDownloadProgress);

        return null;
    }

    cleanupUncompletedDownloads(getModelsDir(modelTier));

    lastDownloadProgress = {
        status: 'downloading',
        overall: { receivedBytes: 0, totalBytes: 0, percent: 0 },
        currentItem: null,
        error: null,
    };

    downloadQInstance = new DownloadQueue(pendingItems, {
        onItemProgress: ({ index, total, taskProgress }) => {
            lastDownloadProgress = {
                status: 'downloading',
                overall: lastDownloadProgress.overall,
                currentItem: {
                    index: index + 1,
                    total,
                    url: taskProgress?.url,
                    destinationPath: taskProgress?.destinationPath,
                    receivedBytes: taskProgress?.downloadedBytes || 0,
                    totalBytes: taskProgress?.totalBytes || 0,
                    percent: taskProgress?.percent ?? null,
                    status: taskProgress?.status,
                },
                error: null,
            };

            if (typeof onProgress === 'function') onProgress(lastDownloadProgress);
        },

        onQueueStatus: (status) => {
            if (status === 'completed') lastDownloadProgress = { ...lastDownloadProgress, status: 'success' };
            if (status === 'paused') lastDownloadProgress = { ...lastDownloadProgress, status: 'paused' };
            if (status === 'canceled') lastDownloadProgress = { ...lastDownloadProgress, status: 'cancelled' };
            if (status === 'downloading') lastDownloadProgress = { ...lastDownloadProgress, status: 'downloading' };
            if (typeof onProgress === 'function') onProgress(lastDownloadProgress);
        },

        onError: (err) => {
            const errorMessage = err?.message || String(err);
            const lowerMessage = errorMessage.toLowerCase();
            const isTlsOrChromiumDownloadFailure =
                lowerMessage.includes('certificate') ||
                lowerMessage.includes('tls') ||
                lowerMessage.includes('ssl') ||
                lowerMessage.includes('chromium download interrupted') ||
                lowerMessage.includes('chromium download interrupted.') ||
                lowerMessage.includes('chromium download cancelled') ||
                lowerMessage.includes('chromium download') ||
                lowerMessage.includes('unable_to_get_issuer_cert_locally') ||
                lowerMessage.includes('unable_to_verify_leaf_signature') ||
                lowerMessage.includes('err_cert');

            lastDownloadProgress = {
                ...lastDownloadProgress,
                status: 'error',
                error: errorMessage,
                ...(isTlsOrChromiumDownloadFailure
                    ? {
                          note: 'Automatic model download failed because the secure connection could not be verified. This can happen on corporate networks that use proxies or SSL inspection, or when this device does not trust the download certificate. Please use the manual download steps from the documentation/help screen and place the model files in the configured models folder.',
                      }
                    : {}),
            };

            if (typeof onProgress === 'function') onProgress(lastDownloadProgress);
        },
        fallbackDownload: (item) => {
            const wc = getDefaultDownloadWebContents();
            if (!wc) return Promise.reject(new Error('No active window available for Chromium fallback download'));
            activeChromiumFallbackUrl = item.url;
            return downloadViaChromium(item.url, item.destinationPath, wc, (taskProgress) => {
                lastDownloadProgress = {
                    status: 'downloading',
                    overall: lastDownloadProgress.overall,
                    currentItem: {
                        index: lastDownloadProgress.currentItem?.index ?? null,
                        total: lastDownloadProgress.currentItem?.total ?? null,
                        url: taskProgress?.url,
                        destinationPath: taskProgress?.destinationPath,
                        receivedBytes: taskProgress?.downloadedBytes || 0,
                        totalBytes: taskProgress?.totalBytes || 0,
                        percent: taskProgress?.percent ?? null,
                        status: taskProgress?.status,
                    },
                    downloadMode: 'chromium',
                    note:
                        "We couldn't verify the download certificate (TLS/SSL). This commonly happens on corporate networks with proxies/SSL inspection. " +
                        'Switching to Chromium-based download as a fallback. Note: pause is not available for this fallback download.',
                    error: null,
                };

                if (typeof onProgress === 'function') onProgress(lastDownloadProgress);
            });
        },
    });

    downloadQInstance.start().catch(() => {});

    return downloadQInstance;
};

/**
 * Cancels the current AI model download operation.
 *
 * If a Chromium fallback download is active, it is cancelled first.
 *
 * @returns {void}
 */
const cancelDownloadModels = () => {
    if (lastDownloadProgress?.downloadMode === 'chromium' && activeChromiumFallbackUrl) {
        cancelChromiumDownload(activeChromiumFallbackUrl);
        activeChromiumFallbackUrl = null;
    }
    if (downloadQInstance) downloadQInstance.cancel();

    if (downloadQInstance) downloadQInstance.cancel();
};
/**
 * Pauses the current AI model download queue.
 *
 * Note that pause may not be available for Chromium fallback downloads.
 *
 * @returns {void}
 */
const pauseDownloadModels = () => {
    if (downloadQInstance) downloadQInstance.pause();
};
/**
 * Resumes a paused AI model download queue.
 *
 * @returns {void}
 */
const resumeDownloadModels = () => {
    if (downloadQInstance) downloadQInstance.resume();
};

/**
 * Returns the most recent AI model download progress state.
 *
 * @returns {Object} Latest known download progress payload.
 */
const getModelDownloadProgressStatus = () => {
    return lastDownloadProgress;
};

const importModelsFromLocalPath = async (sourceDir) => {
    const modelTier = getModelTier();

    const cfg = aiConfig.models[modelTier];

    const baseDir = getModelsDir(modelTier);

    const items = [
        {
            fileName: cfg.whisper.fileName,
            sourcePath: path.join(sourceDir, cfg.whisper.fileName),
            destinationPath: path.join(baseDir, cfg.whisper.fileName),
        },
        {
            fileName: cfg.slmModel.fileName,
            sourcePath: path.join(sourceDir, cfg.slmModel.fileName),
            destinationPath: path.join(baseDir, cfg.slmModel.fileName),
        },
        {
            fileName: cfg.slmProjector.fileName,
            sourcePath: path.join(sourceDir, cfg.slmProjector.fileName),
            destinationPath: path.join(baseDir, cfg.slmProjector.fileName),
        },
        {
            fileName: cfg.embeddingModel.fileName,
            sourcePath: path.join(sourceDir, cfg.embeddingModel.fileName),
            destinationPath: path.join(baseDir, cfg.embeddingModel.fileName),
        },
    ];

    // validate files by model tier.

    const pendingItems = items.filter((item) => {
        const exists = doesFileExist(item.sourcePath);

        return !exists;
    });

    if (pendingItems.length > 0) {
        throw new Error(
            `Download pending for following files: ${pendingItems
                .map((item) => item.fileName)
                .join(',')
                .toString()}`,
        );
    }

    // copy the files from sourcePath to models directory
    items.forEach(async (item) => {
        await fsp.copyFile(item.sourcePath, item.destinationPath);
    });

    return true;
};

module.exports = {
    getModelTier,
    checkForModels,
    getModelPath,
    deleteModels,
    downloadModels,
    cancelDownloadModels,
    pauseDownloadModels,
    resumeDownloadModels,
    getModelDownloadProgressStatus,
    cleanupUncompletedDownloads,
    importModelsFromLocalPath,
};
