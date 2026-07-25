const serviceMethods = require('../../../constants/serviceMethods');
const { validateWatchFolderRemoveArgs } = require('../../service-utils/ipcValidation');
const {
    removeWatchFolderService,
    addWatchFolder,
    removeMediaFromWatchFolder,
    getWatchFoldersService,
    refreshWatchFolderService,
    bulkImportToCollectionService,
    stopBulkImportToCollectionService,
} = require('../../watch-folders/watchFolders.service');

const watchFolderServiceHandlers = [
    [serviceMethods.WATCHFOLDER_GET_LIST, async () => getWatchFoldersService()],
    [serviceMethods.WATCHFOLDER_ADD, async (watchFolder) => addWatchFolder(watchFolder)],
    [serviceMethods.WATCHFOLDER_REMOVE, (watchFolderId) => removeWatchFolderService(watchFolderId)],
    [serviceMethods.WATCHFOLDER_REFRESH, (watchFolderId) => refreshWatchFolderService(watchFolderId)],
    [
        serviceMethods.WATCHFOLDER_REMOVE_MEDIA,
        (mediaId, watchFolderId, initiator) => {
            const validationError = validateWatchFolderRemoveArgs(mediaId, watchFolderId, initiator);
            if (validationError) {
                return validationError;
            }

            return removeMediaFromWatchFolder(mediaId, watchFolderId, initiator);
        },
    ],
    [
        serviceMethods.WATCHFOLDER_BULK_IMPORT_TO_COLLECTION,
        async (mediaList, newCollection) => bulkImportToCollectionService(mediaList, newCollection),
    ],
    [serviceMethods.WATCHFOLDER_STOP_BULK_IMPORT, () => stopBulkImportToCollectionService()],
];

module.exports = { watchFolderServiceHandlers };
