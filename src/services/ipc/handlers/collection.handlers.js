const serviceMethods = require('../../../constants/serviceMethods');
const {
    getCollectionDetailsService,
    renameCollectionService,
    addNewCollectionService,
    removeCollectionService,

    hideCollectionService,
    unhideCollectionService,
} = require('../../collections/collections.service');

const collectionServiceHandlers = [
    [serviceMethods.COLLECTION_HIDE, async (collectionId) => hideCollectionService(collectionId)],
    [serviceMethods.COLLECTION_UNHIDE, async (collectionId) => unhideCollectionService(collectionId)],
    [serviceMethods.COLLECTION_REMOVE, async (collectionId) => removeCollectionService(collectionId)],
    [serviceMethods.COLLECTION_ADD_NEW, async (year, label, isHidden) => addNewCollectionService(year, label, isHidden)],
    [serviceMethods.COLLECTION_RENAME, async (collectionId, newLabel) => renameCollectionService(collectionId, newLabel)],
    [serviceMethods.COLLECTION_GET_DETAILS, async (collectionId, isExColl) => getCollectionDetailsService(collectionId, isExColl)],
];

module.exports = {
    collectionServiceHandlers,
};
