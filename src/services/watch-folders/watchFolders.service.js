const { respondSuccess, respondError, respondFailure, streamToUI } = require('../service-utils/sendToUI');
const { importVideoFromWatchedDirectory } = require('../video-library/videoLibrary');
const { importImageFromWatchedDirectory } = require('../image-library/imageLibrary');
const {
    getMediaDetailsByIdFromWatchFolders,
    initWatchFolderService,
    getWatchFolders,
    addWatchFolder,
    removeWatchFolderMedia,
    getMediaByWatchFolder,
    removeWatchFolder,
    refreshWatchFolder,
} = require('./watchFolders');
const { deleteThumbnail } = require('../thumbnail/thumbnail');
const ipcChannels = require('../../constants/ipcChannels');
const mediaTypes = require('../../constants/mediaTypes');
const mainThreadEvents = require('../../events/mainThreadEvents');
const timeout = require('../service-utils/timeout');
const { importAudioFromWatchedDirectory } = require('../audio-library/audioLibrary');
const responseStatus = require('../../constants/responseStatus');

/**
 * this function would import the video from watch folder to respective collection
 * This touches three services - watch folder service, video library service and collection service
 *
 * @param {*} arg
 */
const importMediaToCollectionService = async (arg) => {
    const { mediaId, newCollection } = arg;

    if (!mediaId || !newCollection) {
        return;
    }

    const mediaDetails = getMediaDetailsByIdFromWatchFolders(mediaId);

    if (!mediaDetails) {
        webContents.send(ipcChannels.IMPORTED_FROM_WATCH_FOLDER_ACTION, {
            status: 'error',
            mediaId: mediaId,
        });
        return;
    }

    try {
        let response;

        if (mediaDetails.mediaType === mediaTypes.IMAGE) {
            response = await importImageFromWatchedDirectory(mediaDetails, newCollection);
        } else if (mediaDetails.mediaType === mediaTypes.VIDEO) {
            response = await importVideoFromWatchedDirectory(mediaDetails, newCollection);
        } else if (mediaDetails.mediaType === mediaTypes.AUDIO) {
            response = await importAudioFromWatchedDirectory(mediaDetails, newCollection);
        }

        if (response.status === responseStatus.SUCCESS || response.status === responseStatus.FAILURE) {
            webContents.send(ipcChannels.IMPORTED_FROM_WATCH_FOLDER_ACTION, {
                status: response.status,
                mediaId: mediaId,
            });
        }
    } catch (err) {
        webContents.send(ipcChannels.IMPORTED_FROM_WATCH_FOLDER_ACTION, {
            status: err?.status || 'error',
            mediaId: mediaId,
        });
    }
};

/**
 * Remove the thumbnails first
 * And then remove the watch folder
 *
 * do you need to send response? probably no. as removal as of today can only be done via settings window
 * @param {*} arg
 */
const removeWatchFolderService = async (watchFolderId) => {
    let updatedWatchFolderList = [];

    try {
        if (watchFolderId) {
            const mediaFiles = getMediaByWatchFolder(watchFolderId);

            if (mediaFiles[0]) {
                for (const mediaFile of mediaFiles) {
                    await deleteThumbnail(mediaFile.id);
                }
            }

            updatedWatchFolderList = await removeWatchFolder(watchFolderId);
        }

        return respondSuccess('Watch folder removed successfully', updatedWatchFolderList);
    } catch (e) {
        return respondError(`Failed to remove watch folder: ${e.message}`);
    }
};

const removeMediaFromWatchFolder = async (mediaId, watchFolderId, initiator) => {
    try {
        await removeWatchFolderMedia(mediaId, watchFolderId, initiator);
        await deleteThumbnail(mediaId);
        return respondSuccess('media removed from watch folder');
    } catch (e) {
        return respondError(`Failed to remove media from watch folder: ${e.message}`);
    }
};

const getWatchFoldersService = () => {
    try {
        const watchfolders = getWatchFolders();
        return respondSuccess('watchfolders', watchfolders);
    } catch (e) {
        return respondSuccess('watchfolders');
    }
};

const refreshWatchFolderService = async (watchFolderId) => {
    const isRefreshDone = await refreshWatchFolder(watchFolderId);

    if (isRefreshDone) {
        return respondSuccess('clean up done');
    }
};
// =============================== BULK IMPORT ===============================

let bulkImportProcess = {
    status: 'idle', // idle | processing | stopping | stopped | complete | error
    progress: {
        currentIndex: 0,
        totalItems: 0,
        currentMediaId: '',
        message: '',
    },
    result: {
        imported: [],
        failed: [],
    },
    error: null,
};

let bulkImportCommand = null;

const isBulkImportStopRequested = () => bulkImportCommand === 'STOP';

const _streamBulkImportUpdate = () => streamToUI(mainThreadEvents.ON_BULK_IMPORT_TO_COLLECTION_PROCESS, bulkImportProcess);

const getBulkImportToCollectionStatus = () => bulkImportProcess;

const stopBulkImportToCollectionService = () => {
    if (bulkImportProcess.status !== 'processing') {
        return respondFailure('No bulk import is currently in progress.');
    }
    bulkImportCommand = 'STOP';
    bulkImportProcess.status = 'stopping';
    bulkImportProcess.progress.message = 'Stopping bulk import...';
    _streamBulkImportUpdate();
    return respondSuccess('Bulk import stop requested.');
};

// Private async runner — processes items one by one and streams progress.
// Intentionally NOT awaited by the public service so the IPC call returns immediately.
const _runBulkImport = async (mediaList, newCollection) => {
    try {
        for (const mediaItem of mediaList) {
            if (isBulkImportStopRequested()) {
                bulkImportProcess.status = 'stopped';
                bulkImportProcess.progress.message = 'Bulk import stopped.';
                _streamBulkImportUpdate();
                break;
            }

            bulkImportProcess.progress.currentMediaId = mediaItem.id;

            const mediaDetails = getMediaDetailsByIdFromWatchFolders(mediaItem.id);

            if (!mediaDetails) {
                bulkImportProcess.result.failed.push({ mediaId: mediaItem.id, reason: 'not_found_in_watch_folder' });
            } else {
                try {
                    let data;

                    if (mediaDetails.mediaType === mediaTypes.IMAGE) {
                        data = await importImageFromWatchedDirectory(mediaDetails, newCollection);
                    } else if (mediaDetails.mediaType === mediaTypes.VIDEO) {
                        data = await importVideoFromWatchedDirectory(mediaDetails, newCollection);
                    } else if (mediaDetails.mediaType === mediaTypes.AUDIO) {
                        data = await importAudioFromWatchedDirectory(mediaDetails, newCollection);
                    }

                    if (data?.status === responseStatus.SUCCESS) {
                        bulkImportProcess.result.imported.push(mediaItem.id);
                    } else {
                        bulkImportProcess.result.failed.push({ mediaId: mediaItem.id, reason: data?.message || 'import_failed' });
                    }
                } catch (err) {
                    bulkImportProcess.result.failed.push({ mediaId: mediaItem.id, reason: err.message });
                }
            }

            bulkImportProcess.progress.message = `${bulkImportProcess.progress.currentIndex} of ${bulkImportProcess.progress.totalItems} processed.`;
            _streamBulkImportUpdate();

            if (bulkImportProcess.progress.currentIndex < bulkImportProcess.progress.totalItems) {
                bulkImportProcess.progress.currentIndex++;
            }

            await timeout(10);
        }

        if (bulkImportProcess.status !== 'stopped') {
            bulkImportProcess.status = 'complete';
            bulkImportProcess.progress.message = `Import complete. ${bulkImportProcess.result.imported.length} imported, ${bulkImportProcess.result.failed.length} failed.`;
            _streamBulkImportUpdate();
        }
    } catch (e) {
        bulkImportProcess.status = 'error';
        bulkImportProcess.error = e.message;
        bulkImportProcess.progress.message = 'An unexpected error occurred during bulk import.';
        _streamBulkImportUpdate();
    }
};

// Public entry point — validates, initialises state, fires the runner and returns immediately.
const bulkImportToCollectionService = (mediaList, newCollection) => {
    if (bulkImportProcess.status === 'processing' || bulkImportProcess.status === 'stopping') {
        return respondFailure('A bulk import is already in progress.');
    }

    if (!mediaList?.length || !newCollection) {
        return respondFailure('Invalid mediaList or collection.');
    }

    // Reset state before firing
    bulkImportProcess = {
        status: 'processing',
        progress: {
            currentIndex: 1,
            totalItems: mediaList.length,
            currentMediaId: '',
            message: 'Starting bulk import...',
        },
        result: { imported: [], failed: [] },
        error: null,
    };
    bulkImportCommand = 'START';
    _streamBulkImportUpdate();

    // Fire-and-forget — IPC call returns immediately, progress arrives via EVENT_STREAM
    _runBulkImport(mediaList, newCollection);

    return respondSuccess('Bulk import started.', { totalItems: mediaList.length });
};

module.exports = {
    importMediaToCollectionService,
    removeWatchFolderService,
    initWatchFolderService,
    getWatchFoldersService,
    addWatchFolder,
    getWatchFolders,
    removeMediaFromWatchFolder,
    getMediaByWatchFolder,
    refreshWatchFolderService,
    bulkImportToCollectionService,
    stopBulkImportToCollectionService,
    getBulkImportToCollectionStatus,
};
