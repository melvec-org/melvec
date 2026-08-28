const path = require('path');
const serviceEventBus = require('../service-utils/serviceEventBus');
const getUniqueID = require('../service-utils/getUniqueID');
const interServiceEvents = require('../../events/interServiceEvents');
const {
    initializeDb,
    getAllCollectionNames,
    getCollectionDetailsById,
    addCollection,
    renameCollectionLabel,
    deleteCollection,
    clearCollectionCache,
    hideCollection,
    unhideCollection,
} = require('../database/collectionsDbService');
const { getVideoDetailsById } = require('../video-library/videoLibrary');
const { getLibDir } = require('../servicePathConfig');
const { renameDirectory, removeEmptyDirectories } = require('../service-utils/fileUtils');
const indexingEvents = require('../../events/indexingEvents');
const mediaTypes = require('../../constants/mediaTypes');

const getMediaByCollection = (collectionId) => {
    const collection = getCollectionDetailsById(collectionId);

    return collection?.mediaItems || [];
};

const getVideosByCollection = (collectionId) => {
    const media = getMediaByCollection(collectionId);

    return media.filter((item) => item.mediaType === mediaTypes.VIDEO).map((item) => item.id);
};

const getVideosByCollections = (collectionIds = []) => {
    let videos = [];

    collectionIds.forEach((collectionId) => {
        const collectionVideos = getVideosByCollection(collectionId);
        videos = videos.concat(collectionVideos);
    });

    return videos;
};

// when you create a collection without any media inside it.
const addNewCollection = (year, label, isHidden) => {
    if (year !== '' && label !== '' && typeof isHidden === 'boolean') {
        const collectionId = getUniqueID();
        addCollection(collectionId, label, year, isHidden);
    } else {
        return null;
    }
};

/**
 * Returns updated Collection items or error
 * @param collectionId
 */
const removeCollection = (collectionId) => {
    const collectionDetails = getCollectionDetailsById(collectionId);
    const isCollectionRemoved = deleteCollection(collectionId);
    const folderPath = path.join(getLibDir(), String(collectionDetails.year), collectionDetails.label);
    if (isCollectionRemoved) {
        removeEmptyDirectories(folderPath);
        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
            change: indexingEvents.COLLECTION_REMOVE,
            collection: collectionId,
        });
    }

    return isCollectionRemoved;
};

/**
 * returns collections list as an array item, The item would look like
 * {
 *  label: "",
 *  path : "",
 * }
 */
const getCollectionsList = () => {
    const allCollections = getAllCollectionNames();

    const transformedCollections = allCollections
        .map((item) => {
            item.isExternal = false;
            return item;
        })
        .sort((a, b) => {
            return a.year - b.year;
        });

    return transformedCollections;
};

let _hiddenCollectionsCache = null;
let _hiddenCollectionsLastFetchTime = 0;
// any call made to fetch hidden collection Ids within a sec will not undergo checking if collection is hidden
const _HIDDEN_COLLECTIONS_CACHE_DURATION_MS = 1000;

// memoized function as to avoid computation in quick succession
const getHiddenCollectionIds = () => {
    const now = Date.now();
    if (_hiddenCollectionsCache && now - _hiddenCollectionsLastFetchTime < _HIDDEN_COLLECTIONS_CACHE_DURATION_MS) {
        return _hiddenCollectionsCache;
    }

    const collections = getCollectionsList();
    _hiddenCollectionsCache = new Set(collections.filter((item) => item.isHidden).map((item) => item.id));
    _hiddenCollectionsLastFetchTime = now;
    return _hiddenCollectionsCache;
};

const onImportFileSuccess = (data) => {
    if (data.completedMediaStats) {
        const mediaStats = Object.assign({}, data.completedMediaStats);
        clearCollectionCache(mediaStats.collection_id);
    } // ignore otherwise
};

const renameCollection = async (collectionId, newLabel) => {
    const collectionDetails = getCollectionDetailsById(collectionId);
    const oldPath = path.join(getLibDir(), String(collectionDetails.year), collectionDetails.label);
    const newPath = path.join(getLibDir(), String(collectionDetails.year), newLabel);

    await renameDirectory(oldPath, newPath);

    const newCollection = renameCollectionLabel(collectionId, newLabel);
    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
        change: indexingEvents.COLLECTION_UPDATE,
        collection: collectionId,
    });
    return newCollection;
};

const onVideoDeleted = (data) => {
    const videoId = data.videoId;
    const videoDetails = getVideoDetailsById(videoId);

    if (videoDetails && videoDetails.collection_id) {
        clearCollectionCache(videoDetails.collection_id);
    }
};

const initCollectionsService = () => {
    initializeDb();
    serviceEventBus.subscribe(interServiceEvents.IMPORT_FILE_SUCCESS, (data) => onImportFileSuccess(data));
    serviceEventBus.subscribe(interServiceEvents.DELETE_VIDEO, onVideoDeleted);
    serviceEventBus.subscribe(interServiceEvents.VIDEO_COLLECTION_CHANGE, (data) => {
        clearCollectionCache(data.newCollectionId);
        clearCollectionCache(data.oldCollectionId);
    });
};

module.exports = {
    initCollectionsService,
    getCollectionsList,
    getHiddenCollectionIds,
    getMediaByCollection,
    getVideosByCollection,

    getVideosByCollections,

    addNewCollection,
    renameCollectionLabel,
    renameCollection,
    removeCollection,
    hideCollection,
    unhideCollection,
};
