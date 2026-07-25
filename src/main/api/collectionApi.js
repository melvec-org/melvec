const serviceMethods = require('../../constants/serviceMethods');
const collectionApi = (ipcRenderer) => ({
    addNewCollection: (year, label, isHidden) => ipcRenderer.invoke(serviceMethods.COLLECTION_ADD_NEW, year, label, isHidden),
    removeCollection: (collectionId) => ipcRenderer.invoke(serviceMethods.COLLECTION_REMOVE, collectionId),
    renameCollection: (collectionId, newLabel) => ipcRenderer.invoke(serviceMethods.COLLECTION_RENAME, collectionId, newLabel),
    hideCollection: (collectionId) => ipcRenderer.invoke(serviceMethods.COLLECTION_HIDE, collectionId),
    unhideCollection: (collectionId) => ipcRenderer.invoke(serviceMethods.COLLECTION_UNHIDE, collectionId),
    getCollectionDetails: (collectionId, isExternalCollection) =>
        ipcRenderer.invoke(serviceMethods.COLLECTION_GET_DETAILS, collectionId, isExternalCollection),
});
module.exports = { collectionApi };
