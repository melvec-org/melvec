const path = require('path');
const {
    getMediaByCollection,
    initCollectionsService,
    removeCollection,
    renameCollection,
    getCollectionsList,
    addNewCollection,
    hideCollection,
    unhideCollection,
} = require('./collections');
const { getThumbnailsDir } = require('../servicePathConfig');

const { getMediaByWatchFolder } = require('../watch-folders/watchFolders.service');
const { getBasicVideoDetailsById, moveVideo, checkForDuplicate } = require('../video-library/videoLibrary.service');
serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { respondSuccess, respondError, respondFailure } = require('../service-utils/sendToUI');
const { getCollectionDetailsById } = require('../database/collectionsDbService');
const { deleteVideoDetails } = require('../video-library/videoLibrary');
const { deleteImageDetails } = require('../image-library/imageLibrary');
const { getBasicImageDetailsById, moveImage } = require('../image-library/imageLibrary');
const { getBasicAudioDetailsById, moveAudio, deleteAudioDetails } = require('../audio-library/audioLibrary');

const indexingEvents = require('../../events/indexingEvents');
const mediaTypes = require('../../constants/mediaTypes');

const moveVideoFromOneCollectionToAnother = async (newCollection, mediaId) => {
    if (newCollection && mediaId) {
        // update in video library service
        await moveVideo(mediaId, newCollection);
        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.VIDEO_COLLECTION_CHANGE });
    }
};

const moveImageFromOneCollectionToAnother = async (newCollection, mediaId) => {
    if (newCollection && mediaId) {
        // update in image library service
        await moveImage(mediaId, newCollection);
        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.IMAGE_COLLECTION_CHANGE });
    }
};

const moveAudioFromOneCollectionToAnother = async (newCollection, mediaId) => {
    if (newCollection && mediaId) {
        // update in image library service
        await moveAudio(mediaId, newCollection);
        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.AUDIO_COLLECTION_CHANGE });
    }
};

const getCollectionDetailsService = (collectionId, isExternalCollection = false) => {
    if (!isExternalCollection) {
        const mediaItemsByCollection = getMediaByCollection(collectionId);

        if (!mediaItemsByCollection[0]) {
            return [];
        }

        return mediaItemsByCollection
            .map((item) => {
                if (item.mediaType === mediaTypes.VIDEO) {
                    return getBasicVideoDetailsById(item.id);
                }

                if (item.mediaType === mediaTypes.IMAGE) {
                    return getBasicImageDetailsById(item.id);
                }

                if (item.mediaType === mediaTypes.AUDIO) {
                    return getBasicAudioDetailsById(item.id);
                }

                return null;
            })
            .filter((item) => item !== null);
    } else {
        const mediaByWatchFolder = getMediaByWatchFolder(collectionId);

        if (!mediaByWatchFolder[0]) {
            return [];
        }

        return mediaByWatchFolder
            .map((media) => {
                return {
                    name: media.name,
                    id: media.id,
                    size: media.size,
                    duration: media.duration,
                    birthtimeMs: media.birthtimeMs,
                    collection: media.coll,
                    path: media.path,
                    isExternal: true,
                    year: media.year,
                    mediaType: media.mediaType || 'video',
                    isDuplicate: checkForDuplicate(media.id),
                    thumbnailURL: path.join(getThumbnailsDir(), `${media.id}.jpg`),
                };
            })
            .filter((item) => item !== null);
    }
};

const addNewCollectionService = (year, label, isHidden) => {
    if (!year || !label || typeof isHidden !== 'boolean') {
        return { status: 'error', message: 'Invalid inputs' };
    }
    try {
        addNewCollection(year, label, isHidden);
        const newCollections = getCollectionsList();

        return respondSuccess(`New collection "${label}" created"`, newCollections);
    } catch (error) {
        return respondError('error', `${error}`);
    }
};

/**
 * TODO  we need to update the path as well while doing the collection renaming
 * @param {*} arg
 */
const renameCollectionService = async (collectionId, newName) => {
    if (!collectionId || !newName) {
        return {
            status: 'error',
            message: 'Invalid collectionId or newName',
        };
    }
    try {
        await renameCollection(collectionId, newName);
        const newCollections = getCollectionsList();
        return respondSuccess(`Collection "${collectionId}" renamed to ${newName}`, newCollections);
    } catch (error) {
        return respondError('error', `${error}`);
    }
};

/**
 *
 * @param {*} arg
 */
const removeCollectionService = async (collectionId) => {
    try {
        if (collectionId) {
            const { mediaItems = [] } = getCollectionDetailsById(collectionId) || {};

            for (const item of mediaItems) {
                if (item.mediaType === mediaTypes.VIDEO) {
                    await deleteVideoDetails(item.id);
                } else if (item.mediaType === mediaTypes.IMAGE) {
                    await deleteImageDetails(item.id);
                } else if (item.mediaType === mediaTypes.AUDIO) {
                    await deleteAudioDetails(item.id, 'user');
                }
            }

            const isRemovalComplete = removeCollection(collectionId);
            if (isRemovalComplete) {
                serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.COLLECTION_REMOVE });

                return respondSuccess(`Collection ${collectionId} removed successfully`, getCollectionsList());
            }
        } else {
            return respondFailure('error', 'Invalid collectionId');
        }
    } catch (error) {
        return respondError('error', `${error}`);
    }
};

const hideCollectionService = (collectionId) => {
    try {
        if (collectionId) {
            hideCollection(collectionId);

            return respondSuccess(`Collection ${collectionId} hidden successfully`, getCollectionsList());
        } else {
            return respondFailure('error', 'Invalid collectionId');
        }
    } catch (error) {
        return respondError('error', `${error}`);
    }
};
const unhideCollectionService = (collectionId) => {
    try {
        if (collectionId) {
            unhideCollection(collectionId);
            return respondSuccess(`Collection ${collectionId} unhidden successfully`, getCollectionsList());
        } else {
            return respondFailure('error', 'Invalid collectionId');
        }
    } catch (error) {
        return respondError('error', `${error}`);
    }
};

module.exports = {
    moveVideoFromOneCollectionToAnother,
    moveImageFromOneCollectionToAnother,
    moveAudioFromOneCollectionToAnother,
    getCollectionDetailsService,
    addNewCollectionService,
    renameCollectionService,
    removeCollectionService,
    hideCollectionService,
    unhideCollectionService,
    initCollectionsService,
};
