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
const { respond } = require('../service-utils/sendToUI');
const { getCollectionDetailsById } = require('../database/collectionsDbService');
const { deleteVideoDetails } = require('../video-library/videoLibrary');
const { deleteImageDetails } = require('../image-library/imageLibrary');
const { getBasicImageDetailsById, moveImage } = require('../image-library/imageLibrary');
const { getBasicAudioDetailsById, moveAudio } = require('../audio-library/audioLibrary');

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

        return respond('success', `New collection "${label}" created"`, newCollections);
    } catch (error) {
        return respond('error', `${error}`);
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
        return {
            status: 'success',
            data: newCollections,
            message: `Collection ${collectionId} renamed to ${newName}`,
        };
    } catch (error) {
        return {
            status: 'error',
            message: `${error}`,
        };
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
                if (item.mediaType === 'video') {
                    await deleteVideoDetails(item.id);
                } else if (item.mediaType === 'image') {
                    await deleteImageDetails(item.id);
                }
            }

            const isRemovalComplete = removeCollection(collectionId);
            if (isRemovalComplete) {
                serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.COLLECTION_REMOVE });

                return {
                    status: 'success',
                    data: getCollectionsList(),
                    message: `Collection ${collectionId} removed successfully`,
                };
            }
        } else {
            return {
                status: 'error',
                message: 'Invalid collectionId',
            };
        }
    } catch (error) {
        return {
            status: 'error',
            message: `${error}`,
        };
    }
};

const hideCollectionService = (collectionId) => {
    try {
        if (collectionId) {
            hideCollection(collectionId);

            return {
                status: 'success',
                data: getCollectionsList(),
                message: `Collection ${collectionId} hidden successfully`,
            };
        } else {
            return {
                status: 'error',
                message: 'Invalid collectionId',
            };
        }
    } catch (error) {
        return {
            status: 'error',
            message: `${error}`,
        };
    }
};
const unhideCollectionService = (collectionId) => {
    try {
        if (collectionId) {
            unhideCollection(collectionId);

            return {
                status: 'success',
                data: getCollectionsList(),
                message: `Collection ${collectionId} unhidden successfully`,
            };
        } else {
            return {
                status: 'error',
                message: 'Invalid collectionId',
            };
        }
    } catch (error) {
        return {
            status: 'error',
            message: `${error}`,
        };
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
