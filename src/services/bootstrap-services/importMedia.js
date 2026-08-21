const fse = require('fs-extra');

const serviceEventBus = require('../service-utils/serviceEventBus');
const systemConfig = require('../../configs/systemConfig');
const path = require('path');

const validateFilename = require('../service-utils/validateFileName');
const { getFileYear } = require('../service-utils/timeUtils');
const { getLibraryRootPath, getLibDir, getNonImportedLibraryDb, getThumbnailsDir } = require('../servicePathConfig');
const { getDirectories, removeEmptyDirectories, writeJSONFile, doesFileExist, removeFile } = require('../service-utils/fileUtils');
const { checkForDuplicate, getVideoDetailsById } = require('../video-library/videoLibrary');
const { checkForDuplicateImage } = require('../database/imageLibraryDbService');
const { checkForDuplicateAudio } = require('../database/audioLibraryDbService');

const generateMediaId = require('../service-utils/generateMediaId');
const interServiceEvents = require('../../events/interServiceEvents');
const getUniqueID = require('../service-utils/getUniqueID');
const { getCollectionByYearAndLabel } = require('../database/collectionsDbService');
const { logLibraryError } = require('../logs/logService');
const timeout = require('../service-utils/timeout');
const { createCollectionName, trimCollectionNameWithSameYear } = require('../service-utils/createCollectionName');
const mainThreadEvents = require('../../events/mainThreadEvents');
const { emitToUI } = require('../service-utils/sendToUI');
const { getVideoDuration } = require('../service-utils/getVideoDuration');
const { generateVideoThumbnail } = require('../service-utils/generateVideoThumbnail');
const { generateImageThumbnail } = require('../service-utils/generateImageThumbnail');
const { getContentCreationTime } = require('../service-utils/getContentCreationTime');

const mediaTypes = require('../../constants/mediaTypes');
const responseStatus = require('../../constants/responseStatus');
const { extractGPSData } = require('../service-utils/extractGPSData');

/**
 * Minimum gap in ms between consecutive file imports.
 * Acts as a yield point to keep the event loop responsive during bulk imports.
 * The actual per-file cost is dominated by generateMediaId, getVideoDuration,
 * and thumbnail generation — not this delay.
 */
const TIME_BETWEEN_IMPORTS = 5; // ms

/**
 * Number of files processed before flushing the non-imported list to disk.
 * Writing on every file is expensive at scale; this batches writes while still
 * preserving crash-recovery safety (worst case: up to N-1 files re-imported on restart,
 * which is safe because duplicate checks handle re-imports gracefully).
 */
const NON_IMPORTED_LIST_FLUSH_INTERVAL = 5; // write to disk every N files

/**
 * Imports a single video file into the target library.
 *
 * Steps:
 *  1. Generates a content-based hash ID for the file.
 *  2. Checks for duplicates in the existing library.
 *     - If duplicate exists and the file is already in the target: removes the source and returns 'na'.
 *     - If duplicate exists but the file is missing from target: moves to the known path and returns responseStatus.SUCCESS.
 *  3. For new videos: resolves the target collection, moves the file, and returns full media metadata.
 *
 * @param {object} mediaStats - File metadata from the scanner (path, birthtimeMs, size, etc.)
 * @param {string} targetLibrary - Absolute path to the library root directory.
 * @returns {Promise<{status: responseStatus.SUCCESS|'failure'|'na', newMediaStats?: object, fileStats?: object, errorDetails?: string, mediaType: string}>}
 */
const importVideoToLibrary = async (mediaStats = {}, targetLibrary = '') => {
    await timeout(TIME_BETWEEN_IMPORTS);

    let videoId = '';

    if (doesFileExist(mediaStats.path)) {
        videoId = await generateMediaId(mediaStats.path);
    } else {
        return {
            status: 'failure',
            fileStats: mediaStats,
            errorDetails: 'File does not exist',
            mediaType: 'video',
        };
    }

    const fileName = mediaStats.path.split('/').pop();

    const duplicateVideo = checkForDuplicate(videoId);
    let doesVideoExistInTargetLibrary = false;
    if (duplicateVideo) {
        const existingFileStats = getVideoDetailsById(videoId);
        let targetVideoPath = existingFileStats.path;
        targetVideoPath = path.join(getLibDir(), targetVideoPath);

        doesVideoExistInTargetLibrary = doesFileExist(targetVideoPath);

        if (doesVideoExistInTargetLibrary) {
            await removeFile(mediaStats.path);

            return {
                status: 'na',
                fileStats: mediaStats,
                errorDetails: `Video ${mediaStats.path} already exists in target library: ${targetVideoPath}`,
                mediaType: 'video',
            };
        } else {
            try {
                await fse.move(mediaStats.path, targetVideoPath);
                return {
                    status: responseStatus.SUCCESS,
                    newMediaStats: existingFileStats,
                    mediaType: 'video',
                };
            } catch (e) {
                return {
                    status: 'failure',
                    fileStats: mediaStats,
                    errorDetails: e,
                    mediaType: 'video',
                };
            }
        }
    }

    const collectionYear = getFileYear(mediaStats.birthtimeMs);

    const uniqueIDPrefix = `_${videoId}_`;

    const strippedRelativePath = mediaStats.path.replace(getLibraryRootPath(), '');

    let collectionName = createCollectionName(strippedRelativePath);
    // strip down the year if used in the beining.
    collectionName = trimCollectionNameWithSameYear(collectionName, collectionYear);

    let fileNameWihoutId = fileName;

    if (fileNameWihoutId.startsWith(uniqueIDPrefix) && fileNameWihoutId.length > uniqueIDPrefix.length) {
        fileNameWihoutId = fileNameWihoutId.substring(uniqueIDPrefix.length);
    }

    let uniqueFileName = uniqueIDPrefix + fileNameWihoutId;

    uniqueFileName = validateFilename(uniqueFileName);

    const newPathForVideo = path.join(String(collectionYear), collectionName, uniqueFileName);

    const collectionDetails = getCollectionByYearAndLabel(collectionYear, collectionName);

    let collection_id = '';
    if (collectionDetails) {
        collection_id = collectionDetails.id;
    } else {
        collection_id = getUniqueID();
    }

    const videoDuration = await getVideoDuration(mediaStats.path);

    const newMediaStats = {
        id: videoId,
        name: fileNameWihoutId,
        birthtimeMs: parseInt(mediaStats.birthtimeMs),
        path: newPathForVideo,
        size: mediaStats.size,
        coll: collectionName,
        collection_id: collection_id,
        year: collectionYear,
        duration: videoDuration,
        has_preview: false,
    };

    try {
        const fullPath = path.join(targetLibrary, newPathForVideo);

        try {
            await fse.move(mediaStats.path, fullPath);
            return {
                status: responseStatus.SUCCESS,
                newMediaStats: newMediaStats,
                fullPath: fullPath,
                mediaType: 'video',
            };
        } catch (e) {
            return {
                status: 'failure',
                fileStats: mediaStats,
                errorDetails: e,
                mediaType: 'video',
            };
        }
    } catch (e) {
        return {
            status: 'failure',
            fileStats: mediaStats,
            errorDetails: e,
            mediaType: 'video',
        };
    }
};

/**
 * Imports a single image file into the target library.
 *
 * Steps:
 *  1. Generates a content-based hash ID for the file.
 *  2. Checks for duplicates — returns 'na' if the image already exists in the library.
 *  3. For new images: resolves the target collection, moves the file, and returns full media metadata.
 *
 * @param {object} mediaStats - File metadata from the scanner (path, birthtimeMs, size, etc.)
 * @param {string} targetLibrary - Absolute path to the library root directory.
 * @returns {Promise<{status: responseStatus.SUCCESS|'failure'|'na', newMediaStats?: object, fileStats?: object, errorDetails?: string, mediaType: string}>}
 */
const importImageToLibrary = async (mediaStats = {}, targetLibrary = '') => {
    await timeout(TIME_BETWEEN_IMPORTS);

    let imageId = '';

    if (doesFileExist(mediaStats.path)) {
        imageId = await generateMediaId(mediaStats.path);
    } else {
        return {
            status: 'failure',
            fileStats: mediaStats,
            errorDetails: 'File does not exist',
            mediaType: mediaTypes.IMAGE,
        };
    }

    const isDuplicateImage = checkForDuplicateImage(imageId);
    if (isDuplicateImage) {
        return {
            status: 'na',
            fileStats: mediaStats,
            errorDetails: `Image ${mediaStats.path} already exists in the library`,
            mediaType: mediaTypes.IMAGE,
        };
    }

    const fileName = mediaStats.path.split('/').pop();
    const collectionYear = getFileYear(mediaStats.birthtimeMs);

    const uniqueIDPrefix = `_${imageId}_`;
    const strippedRelativePath = mediaStats.path.replace(getLibraryRootPath(), '');

    let collectionName = createCollectionName(strippedRelativePath);
    // strip down the year if used in the beining.
    collectionName = trimCollectionNameWithSameYear(collectionName, collectionYear);

    let fileNameWihoutId = fileName;

    if (fileNameWihoutId.startsWith(uniqueIDPrefix) && fileNameWihoutId.length > uniqueIDPrefix.length) {
        fileNameWihoutId = fileNameWihoutId.substring(uniqueIDPrefix.length);
    }

    let uniqueFileName = uniqueIDPrefix + fileNameWihoutId;
    uniqueFileName = validateFilename(uniqueFileName);

    const newPathForImage = path.join(String(collectionYear), collectionName, uniqueFileName);

    const collectionDetails = getCollectionByYearAndLabel(collectionYear, collectionName);

    let collection_id = '';
    if (collectionDetails) {
        collection_id = collectionDetails.id;
    } else {
        collection_id = getUniqueID();
    }

    const newMediaStats = {
        id: imageId,
        name: fileNameWihoutId,
        birthtimeMs: parseInt(mediaStats.birthtimeMs),
        path: newPathForImage,
        size: mediaStats.size,
        coll: collectionName,
        collection_id: collection_id,
        year: collectionYear,
    };

    try {
        const fullPath = path.join(targetLibrary, newPathForImage);

        try {
            await fse.move(mediaStats.path, fullPath);
            return {
                status: responseStatus.SUCCESS,
                newMediaStats: newMediaStats,
                fullPath: fullPath,
                mediaType: mediaTypes.IMAGE,
            };
        } catch (e) {
            return {
                status: 'failure',
                fileStats: mediaStats,
                errorDetails: e,
                mediaType: mediaTypes.IMAGE,
            };
        }
    } catch (e) {
        return {
            status: 'failure',
            fileStats: mediaStats,
            errorDetails: e,
            mediaType: mediaTypes.IMAGE,
        };
    }
};

const importAudioToLibrary = async (mediaStats = {}, targetLibrary = '') => {
    await timeout(TIME_BETWEEN_IMPORTS);

    let audioId = '';

    if (doesFileExist(mediaStats.path)) {
        audioId = await generateMediaId(mediaStats.path);
    } else {
        return {
            status: 'failure',
            fileStats: mediaStats,
            errorDetails: 'File does not exist',
            mediaType: mediaTypes.AUDIO,
        };
    }

    const isDuplicateAudio = checkForDuplicateAudio(audioId);
    if (isDuplicateAudio) {
        return {
            status: 'na',
            fileStats: mediaStats,
            errorDetails: `Audio ${mediaStats.path} already exists in the library`,
            mediaType: mediaTypes.AUDIO,
        };
    }

    const fileName = mediaStats.path.split('/').pop();
    const collectionYear = getFileYear(mediaStats.birthtimeMs);

    const uniqueIDPrefix = `_${audioId}_`;
    const strippedRelativePath = mediaStats.path.replace(getLibraryRootPath(), '');

    let collectionName = createCollectionName(strippedRelativePath);
    collectionName = trimCollectionNameWithSameYear(collectionName, collectionYear);

    let fileNameWihoutId = fileName;

    if (fileNameWihoutId.startsWith(uniqueIDPrefix) && fileNameWihoutId.length > uniqueIDPrefix.length) {
        fileNameWihoutId = fileNameWihoutId.substring(uniqueIDPrefix.length);
    }

    let uniqueFileName = uniqueIDPrefix + fileNameWihoutId;
    uniqueFileName = validateFilename(uniqueFileName);

    const newPathForAudio = path.join(String(collectionYear), collectionName, uniqueFileName);

    const collectionDetails = getCollectionByYearAndLabel(collectionYear, collectionName);

    let collection_id = '';
    if (collectionDetails) {
        collection_id = collectionDetails.id;
    } else {
        collection_id = getUniqueID();
    }

    const audioDuration = await getVideoDuration(mediaStats.path);

    const newMediaStats = {
        id: audioId,
        name: fileNameWihoutId,
        birthtimeMs: parseInt(mediaStats.birthtimeMs),
        path: newPathForAudio,
        size: mediaStats.size,
        coll: collectionName,
        collection_id: collection_id,
        year: collectionYear,
        role: mediaStats.role || mediaTypes.AUDIO,
        duration: audioDuration ?? null,
    };

    try {
        const fullPath = path.join(targetLibrary, newPathForAudio);

        try {
            await fse.move(mediaStats.path, fullPath);
            return {
                status: responseStatus.SUCCESS,
                newMediaStats: newMediaStats,
                fullPath: fullPath,
                mediaType: mediaTypes.AUDIO,
            };
        } catch (e) {
            return {
                status: 'failure',
                fileStats: mediaStats,
                errorDetails: e,
                mediaType: mediaTypes.AUDIO,
            };
        }
    } catch (e) {
        return {
            status: 'failure',
            fileStats: mediaStats,
            errorDetails: e,
            mediaType: mediaTypes.AUDIO,
        };
    }
};

const enrichMediaStatsWithContentCreationTime = async (mediaStats = {}) => {
    const contentCreationTime = await getContentCreationTime(mediaStats.path, mediaStats.mediaType);

    return {
        ...mediaStats,
        birthtimeMs: parseInt(contentCreationTime || mediaStats.birthtimeMs),
    };
};

const importMediaToLibrary = async (mediaStats = {}, targetLibrary = '') => {
    if (!mediaStats.mediaType) {
        return {
            status: 'failure',
            fileStats: mediaStats,
            errorDetails: 'Media type is missing',
            mediaType: 'unknown',
        };
    }

    const normalizedMediaStats = await enrichMediaStatsWithContentCreationTime(mediaStats);

    if (normalizedMediaStats.mediaType === mediaTypes.VIDEO) {
        return importVideoToLibrary(normalizedMediaStats, targetLibrary);
    }

    if (normalizedMediaStats.mediaType === mediaTypes.IMAGE) {
        return importImageToLibrary(normalizedMediaStats, targetLibrary);
    }

    if (normalizedMediaStats.mediaType === mediaTypes.AUDIO) {
        return importAudioToLibrary(normalizedMediaStats, targetLibrary);
    }

    return {
        status: 'failure',
        fileStats: normalizedMediaStats,
        errorDetails: `Unsupported media type for file: ${normalizedMediaStats.path}`,
        mediaType: normalizedMediaStats.mediaType,
    };
};

/**
 * Persists the current import state to the non-imported DB file.
 * Filters out already-imported entries so only pending files remain on disk.
 * Used for crash recovery — on restart, only files still in this list will be re-imported.
 * Called periodically (every NON_IMPORTED_LIST_FLUSH_INTERVAL files) rather than on every
 * file to reduce redundant disk writes during large imports.
 *
 * @param {object[]} mediaList - The full media list with `imported` flags set.
 */
const updateNonImportedList = (mediaList) => {
    const updatedMediaList = mediaList.filter((item) => item.imported !== true);
    writeJSONFile(getNonImportedLibraryDb(), updatedMediaList);
};

/**
 * Sequentially imports a list of pending media files into the library.
 *
 * For each file:
 *  - Skips already-imported entries.
 *  - Delegates to importVideoToLibrary or importImageToLibrary via importMediaToLibrary.
 *  - On success: generates a thumbnail, marks the file as imported, and emits UI progress events.
 *  - On 'na' (duplicate): marks as imported without thumbnail generation.
 *  - On failure: logs the error and flags the file for retry on next startup.
 *
 * The non-imported DB is flushed to disk every NON_IMPORTED_LIST_FLUSH_INTERVAL files
 * (and once more after the loop) to balance crash-safety against write overhead.
 *
 * @param {object[]} mediaList - Array of file metadata objects to import.
 * @param {string} libraryPath - Absolute path to the target library directory.
 * @returns {Promise<{status: responseStatus.SUCCESS|'failure'|'import partially successful', message: string, importedMediaCount: number}|null>}
 *   Returns null if libraryPath is not provided.
 */
const importMedia = async (mediaList, libraryPath = '') => {
    if (libraryPath === '') {
        logLibraryError('Library Path not defined');
        return null;
    }

    let importErrorCount = 0;
    let importedMediaCount = 0;
    let filesSinceLastFlush = 0;
    let hasEmittedStart = false;

    for (let i = 0; i < mediaList.length; i++) {
        if (mediaList[i].imported == true || mediaList[i] === false) continue;

        // Defer the "Importing started" signal until we know there is at least
        // one file that actually needs importing, so the UI is not shown during
        // routine library validation when everything is already up to date.
        if (!hasEmittedStart) {
            emitToUI(mainThreadEvents.ON_IMPORT_PROGRESS, {
                totalCount: mediaList.length,
                currentIndex: 0,
                message: `Importing started.`,
            });
            hasEmittedStart = true;
        }

        const operationData = await importMediaToLibrary(mediaList[i], libraryPath);

        if (operationData.status === responseStatus.SUCCESS) {
            if (operationData.mediaType === mediaTypes.VIDEO) {
                try {
                    await generateVideoThumbnail({
                        videoPath: operationData?.fullPath,
                        thumbnailFolder: getThumbnailsDir(),
                        videoId: operationData.newMediaStats?.id,
                    });
                } catch (e) {}
            }

            if (operationData.mediaType === mediaTypes.IMAGE) {
                try {
                    await generateImageThumbnail({
                        imagePath: operationData?.fullPath,
                        thumbnailFolder: getThumbnailsDir(),
                        imageId: operationData.newMediaStats?.id,
                    });
                } catch (e) {}
            }

            let gpsData = await extractGPSData(operationData?.fullPath, operationData.mediaType);

            if (gpsData) {
                if (gpsData.latitude && gpsData.longitude) {
                    operationData.newMediaStats.latitude = gpsData.latitude;
                    operationData.newMediaStats.longitude = gpsData.longitude;
                }
            }
            mediaList[i].imported = true;
            importedMediaCount++;
            filesSinceLastFlush++;

            if (filesSinceLastFlush >= NON_IMPORTED_LIST_FLUSH_INTERVAL) {
                updateNonImportedList(mediaList);
                filesSinceLastFlush = 0;
            }

            serviceEventBus.publish(interServiceEvents.IMPORT_FILE_SUCCESS, {
                totalCount: mediaList.length,
                currentIndex: i + 1,
                completedMediaStats: operationData.newMediaStats,
                mediaType: operationData.mediaType,
                videoList: mediaList,
            });

            emitToUI(mainThreadEvents.ON_IMPORT_PROGRESS, {
                data: {
                    totalCount: mediaList.length,
                    currentIndex: i + 1,
                },
                message: `Importing ${i + 1} files of total ${mediaList.length} files...`,
            });
        } else if (operationData.status === 'na') {
            mediaList[i].imported = true;
            importedMediaCount++;
            filesSinceLastFlush++;

            if (filesSinceLastFlush >= NON_IMPORTED_LIST_FLUSH_INTERVAL) {
                updateNonImportedList(mediaList);
                filesSinceLastFlush = 0;
            }

            logLibraryError(`Importing not required. Error: ${operationData.errorDetails}`);
        } else {
            mediaList[i].imported = false;
            mediaList[i].importError = operationData.errorDetails;
            importErrorCount++;
            filesSinceLastFlush++;
            logLibraryError(`Error importing media: ${operationData.fileStats.path}, error: ${operationData.errorDetails}`);

            if (filesSinceLastFlush >= NON_IMPORTED_LIST_FLUSH_INTERVAL) {
                updateNonImportedList(mediaList);
                filesSinceLastFlush = 0;
            }
        }
    }

    // Final flush to ensure any remaining progress is persisted
    if (filesSinceLastFlush > 0) {
        updateNonImportedList(mediaList);
    }

    let status = responseStatus.SUCCESS;
    if (importedMediaCount === mediaList.length) {
        status = responseStatus.SUCCESS;
    } else if (importErrorCount === mediaList.length) {
        status = 'failure';
    } else if (importErrorCount > 0 && importedMediaCount > 0) {
        status = 'import partially successful';
    }
    return {
        status: status,
        message: `Could not import ${importErrorCount} files.`,
        importedMediaCount: importedMediaCount,
    };
};

/**
 * Removes empty source folders left behind after import.
 * Only considers directories that are not part of the system directory list
 * (i.e. not the library, thumbnails, trash, or private dirs).
 * Leaves non-empty directories untouched.
 */
const cleanupImportSourceFolders = async () => {
    const allDirectoryNames = await getDirectories(getLibraryRootPath());
    const redundantDirectories = allDirectoryNames.filter((item) => !systemConfig.SYSTEM_DIRECTORY_LIST_REGEX.test(item));

    for (let i = 0; i < redundantDirectories.length; i++) {
        await removeEmptyDirectories(path.join(getLibraryRootPath(), redundantDirectories[i]));
    }
};

module.exports = {
    importMedia,
    cleanupImportSourceFolders,
};
