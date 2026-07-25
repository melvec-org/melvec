const serviceMethods = require('../../constants/serviceMethods');
const watchFoldersApi = (ipcRenderer) => ({
    getWatchFolders: () => ipcRenderer.invoke(serviceMethods.WATCHFOLDER_GET_LIST),
    addWatchFolder: (watchFolder) => ipcRenderer.invoke(serviceMethods.WATCHFOLDER_ADD, watchFolder),
    removeWatchFolder: (watchFolderId) => ipcRenderer.invoke(serviceMethods.WATCHFOLDER_REMOVE, watchFolderId),
    refreshWatchFolder: (watchFolderId) => ipcRenderer.invoke(serviceMethods.WATCHFOLDER_REFRESH, watchFolderId),
    removeMediaFromWatchFolder: (mediaId, watchFolderId, initiator) =>
        ipcRenderer.invoke(serviceMethods.WATCHFOLDER_REMOVE_MEDIA, mediaId, watchFolderId, initiator),
    bulkImportToCollection: (mediaList, newCollection) =>
        ipcRenderer.invoke(serviceMethods.WATCHFOLDER_BULK_IMPORT_TO_COLLECTION, mediaList, newCollection),
    stopBulkImportToCollection: () => ipcRenderer.invoke(serviceMethods.WATCHFOLDER_STOP_BULK_IMPORT),
});
module.exports = { watchFoldersApi };
