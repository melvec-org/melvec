const serviceMethods = require('../../constants/serviceMethods');
const commonMediaApi = (ipcRenderer) => ({
    renameMediaFile: (mediaType, mediaId, oldFileName, newFileName) =>
        ipcRenderer.invoke(serviceMethods.MEDIA_RENAME_FILE, mediaType, mediaId, oldFileName, newFileName),
    updateMediaTitle: (mediaType, videoId, title) => ipcRenderer.invoke(serviceMethods.MEDIA_UPDATE_TITLE, mediaType, videoId, title),
    updateMediaNsfwStatus: (mediaType, videoId, isNsfw) =>
        ipcRenderer.invoke(serviceMethods.MEDIA_UPDATE_NSFW_STATUS, mediaType, videoId, isNsfw),
    bulkRemoveMedia: (mediaList, collectionId, isExternal) =>
        ipcRenderer.invoke(serviceMethods.MEDIA_BULK_REMOVE, mediaList, collectionId, isExternal),
    changeBulkMediaNsfwStatus: (mediaList, isNsfw) => ipcRenderer.invoke(serviceMethods.MEDIA_BULK_UPDATE_NSFW_STATUS, mediaList, isNsfw),
    changeBulkMediaCategory: (mediaList, categoryId) =>
        ipcRenderer.invoke(serviceMethods.MEDIA_BULK_UPDATE_CATEGORY, mediaList, categoryId),
    changeBulkMediaCollection: (mediaList, newCollectionId) =>
        ipcRenderer.invoke(serviceMethods.MEDIA_BULK_UPDATE_COLLECTION, mediaList, newCollectionId),

    resetBulkMediaMetadata: (mediaList, metaDataList) =>
        ipcRenderer.invoke(serviceMethods.MEDIA_BULK_RESET_METADATA, mediaList, metaDataList),

    removeMediaFromLibrary: (mediaType, mediaId, initiator) =>
        ipcRenderer.invoke(serviceMethods.MEDIA_REMOVE_FROM_LIBRARY, mediaType, mediaId, initiator),
});
module.exports = { commonMediaApi };
