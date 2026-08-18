// this very similar to videoLibraryService.js

const { removeFile, doesFileExistAsync } = require('../service-utils/fileUtils');
const scanMediaFiles = require('../service-utils/scanMediaFiles');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const generateMediaId = require('../service-utils/generateMediaId');
const { getFileYear } = require('../service-utils/timeUtils');
const systemConfig = require('../../configs/systemConfig');
const { deleteThumbnail } = require('../thumbnail/thumbnail');
const { getVideoDuration } = require('../service-utils/getVideoDuration');
const { getContentCreationTime } = require('../service-utils/getContentCreationTime');
const getMediaTypeFromPath = require('../service-utils/getMediaTypeFromPath');
const {
    initializeDb,
    getAllWatchFolders,
    getWatchFolderById,
    addWatchFolder: addWatchFolderToDb,
    removeWatchFolder: removeWatchFolderFromDb,
    getMediaByWatchFolderId,
    addWatchFolderMedia,
    removeWatchFolderMedia: removeWatchFolderMediaFromDb,
    removeWatchFolderMediaByWatchFolderId,
} = require('../database/watchFoldersDbService');
const responseStatus = require('../../constants/responseStatus');
const mediaTypes = require('../../constants/mediaTypes');
const { logLibraryError } = require('../logs/logService');

const searchMediaByWatchFolder = (watchFolder) => {
    const excludeDirList = [];
    excludeDirList.push(/.DS_Store/);
    excludeDirList.push(/.melvec/);
    excludeDirList.push(new RegExp(systemConfig.TRASHBIN_DIR));

    return scanMediaFiles({
        rootFolder: watchFolder.path,
        attributes: ['birthtimeMs', 'type', 'size'],
        exclude: excludeDirList,
        extensions: systemConfig.SUPPORTED_MEDIA_EXTENSIONS,
    });
};

/**
 * This process is kept separate as this a costly process because of generateMediaId function
 * which may take few milliseconds to few seconds
 * @param {*} scannedMediaData
 * @returns
 */
const addMediaMetricsToScannedItem = async (scannedItemData) => {
    scannedItemData.id = await generateMediaId(scannedItemData.path);
    scannedItemData.mediaType = getMediaTypeFromPath(scannedItemData.path);

    const contentCreationTime = await getContentCreationTime(scannedItemData.path, scannedItemData.mediaType);
    scannedItemData.birthtimeMs = contentCreationTime ? contentCreationTime * 1000 : parseInt(scannedItemData.birthtimeMs);
    scannedItemData.year = getFileYear(scannedItemData.birthtimeMs);

    if (scannedItemData.mediaType === mediaTypes.VIDEO || scannedItemData.mediaType === mediaTypes.AUDIO) {
        scannedItemData.duration = await getVideoDuration(scannedItemData.path);
    } else {
        scannedItemData.duration = null;
    }

    return scannedItemData;
};

/**
 * Create a new watch folder and sync its media in db
 * @param {*} watchFolder
 * @returns
 */
const scanAndSyncWatchFolderMedia = async (watchFolder) => {
    const mediaData = await searchMediaByWatchFolder(watchFolder);
    const existingMedia = getMediaByWatchFolder(watchFolder.id);

    const scannedItems = [];

    for (const mediaItem of mediaData) {
        if (!mediaItem || typeof mediaItem.path !== 'string' || mediaItem.path.trim() === '') continue;

        const alreadyExists = existingMedia.some(
            (existingMediaItem) =>
                existingMediaItem && typeof existingMediaItem.path === 'string' && existingMediaItem.path === mediaItem.path,
        );

        if (!alreadyExists) {
            const updatedMediaItem = await addMediaMetricsToScannedItem(mediaItem);
            scannedItems.push(updatedMediaItem);
        }
    }

    if (scannedItems.length > 0) {
        const mediaToInsert = scannedItems.map((item) => ({
            id: item.id,
            watchFolderId: watchFolder.id,
            path: item.path,
            name: item.name,
            birthtimeMs: parseInt(item.birthtimeMs),
            year: item.year,
            size: parseInt(item.size),
            mediaType: item.mediaType,
            duration: item.duration ?? null,
        }));

        addWatchFolderMedia(mediaToInsert);
    }

    return getMediaByWatchFolderId(watchFolder.id);
};
/**
 * Create a new watch folder record and initialize its media data.
 * @param {*} watchfolder
 * @returns
 */
const addWatchFolder = async (watchfolder) => {
    const { id, path, label } = watchfolder;

    if (id && path && label) {
        const existingFolder = getWatchFolderById(id);

        if (!existingFolder) {
            const newWatchFolder = addWatchFolderToDb(id, path, label);

            await scanAndSyncWatchFolderMedia(newWatchFolder);
        }
    }

    return getWatchFolders();
};

const getWatchFolders = () => {
    return getAllWatchFolders();
};

const removeWatchFolder = async (id) => {
    const watchFolderDetails = getWatchFolderById(id);

    if (!watchFolderDetails) {
        return getWatchFolders();
    }

    removeWatchFolderMediaByWatchFolderId(id);
    removeWatchFolderFromDb(id);

    return getWatchFolders();
};

const getMediaByWatchFolder = (watchFolderId) => {
    return getMediaByWatchFolderId(watchFolderId);
};

// brut force search all watch folders data
const findMediaFromAllWatchFolders = (mediaId) => {
    const watchFoldersList = getWatchFolders();

    for (const watchFolder of watchFoldersList) {
        const mediaItems = getMediaByWatchFolder(watchFolder.id);
        const mediaItem = mediaItems.find((item) => item.id === mediaId);

        if (mediaItem) {
            return {
                ...mediaItem,
                watchFolderId: mediaItem.watchFolderId || watchFolder.id,
            };
        }
    }

    return null;
};

const getMediaDetailsByIdFromWatchFolders = (mediaId) => {
    return findMediaFromAllWatchFolders(mediaId) || null;
};

const removeMediaFromWatchFolder = (watchFolderId, mediaId) => {
    const watchFolderData = getWatchFolderById(watchFolderId);

    if (!watchFolderData) {
        return {
            status: 'error',
            message: 'Watch folder not found',
        };
    }

    removeWatchFolderMediaFromDb(mediaId);
};

const validateAllWatchFolders = () => {
    const watchFolders = getWatchFolders();

    if (watchFolders.length > 0) {
        watchFolders.forEach((watchFolder) => {
            refreshWatchFolder(watchFolder.id);
        });
    } else {
        return 'No watch folders found';
    }
};

const onImportFileSuccess = (data) => {
    if (data?.completedMediaStats?.watchFolderId) {
        removeMediaFromWatchFolder(data.completedMediaStats.watchFolderId, data.completedMediaStats.id);
    }
};

// physically removes - not imports
const removeWatchFolderMedia = async (mediaId, watchFolderId, initiator = 'user') => {
    const mediaItems = getMediaByWatchFolder(watchFolderId);

    if (mediaItems) {
        const mediaIndex = mediaItems.findIndex((item) => item.id === mediaId);

        if (mediaIndex > -1) {
            if (initiator !== 'INOENT') {
                try {
                    const removalStatus = await removeFile(mediaItems[mediaIndex].path);
                    if (removalStatus.status === responseStatus.SUCCESS) {
                        removeWatchFolderMediaFromDb(mediaId);
                        return true;
                    }
                    logLibraryError(`Error removing media file for ${mediaId}: ${removalStatus.message}`);
                    return false;
                } catch (err) {
                    logLibraryError(`Error removing media file: ${err}`);
                    return false;
                }
            } else {
                removeWatchFolderMediaFromDb(mediaId);
                return true;
            }
        }
    }
};

const refreshWatchFolder = async (watchFolderId) => {
    const mediaItems = getMediaByWatchFolder(watchFolderId);

    if (mediaItems.length > 0) {
        for (const mediaItem of mediaItems) {
            const doesMediaExist = await doesFileExistAsync(mediaItem.path);

            if (!doesMediaExist) {
                await deleteThumbnail(mediaItem.id);
                removeMediaFromWatchFolder(watchFolderId, mediaItem.id);
            }
        }
    }

    const watchFolderData = getWatchFolderById(watchFolderId);

    try {
        if (watchFolderData) {
            await scanAndSyncWatchFolderMedia(watchFolderData);
            return true;
        }
    } catch (e) {
        return false;
    }
};

const initWatchFolderService = () => {
    initializeDb();

    setTimeout(() => {
        validateAllWatchFolders();
    }, 1000);

    serviceEventBus.subscribe(interServiceEvents.IMPORT_FILE_SUCCESS, onImportFileSuccess);
};

module.exports = {
    initWatchFolderService,
    addWatchFolder,
    removeWatchFolder,
    getWatchFolders,
    getMediaByWatchFolder,
    getMediaDetailsByIdFromWatchFolders,
    removeWatchFolderMedia,
    refreshWatchFolder,
};
