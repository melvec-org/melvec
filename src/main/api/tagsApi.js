const serviceMethods = require('../../constants/serviceMethods');
const tagsApi = (ipcRenderer) => ({
    addNewTag: (tag) => ipcRenderer.invoke(serviceMethods.TAGS_ADD_NEW, tag),
    removeTag: (tagId) => ipcRenderer.invoke(serviceMethods.TAGS_REMOVE, tagId),
    renameTag: (tagId, newLabel) => ipcRenderer.invoke(serviceMethods.TAGS_RENAME, tagId, newLabel),
    getLastUsedTagsList: () => ipcRenderer.invoke(serviceMethods.TAGS_GET_LAST_USED_LIST),
    getMostUsedTagsList: () => ipcRenderer.invoke(serviceMethods.TAGS_GET_MOST_USED_LIST),
    getTopTagPlaylistDetails: (tagId) => ipcRenderer.invoke(serviceMethods.TAGS_GET_TOP_TAG_PLAYLIST_DETAILS, tagId),

    addMediaToTag: (mediaType, mediaId, tagId) => ipcRenderer.invoke(serviceMethods.TAGS_ADD_MEDIA_TO_TAG, mediaType, mediaId, tagId),
    removeMediaFromTag: (mediaType, mediaId, tagId) =>
        ipcRenderer.invoke(serviceMethods.TAGS_REMOVE_MEDIA_FROM_TAG, mediaType, mediaId, tagId),
    addMediaToNewTag: (mediaType, mediaId, tagId, tagLabel) =>
        ipcRenderer.invoke(serviceMethods.TAGS_ADD_MEDIA_TO_NEW_TAG, mediaType, mediaId, tagId, tagLabel),
});
module.exports = { tagsApi };
