const { respondError, respondSuccess, respondFailure } = require('./service-utils/sendToUI');
const {
    updateVideoTitleService,
    updateNsfwStatusService: updateVideoNsfwStatusService,
    renameVideoFile,
    removeVideoFromLibrary,
    removeVideoFromLibraryService,
} = require('./video-library/videoLibrary.service');
const { updateNsfwStatus: updateVideoNsfwStatus, updateVideoCategory, resetVideosMetaData } = require('./video-library/videoLibrary');
const {
    updateImageTitleService,
    updateImageNsfwStatusService,
    renameImageFileService,
    removeImageFromLibrary,
    updateImageNsfwStatus,
    resetImagesMetaData,
} = require('./image-library/imageLibrary.service');
const {
    moveVideoFromOneCollectionToAnother,
    moveImageFromOneCollectionToAnother,
    moveAudioFromOneCollectionToAnother,
} = require('../services/collections/collections.service');
const mediaTypes = require('../constants/mediaTypes');

const {
    addVideoToTagService,
    addImageToTagService,
    addImageToNewTagService,
    addVideoToNewTagService,
    removeImageFromTagService,
    removeVideoFromTagService,
    removeAudioFromTagService,
    addAudioToNewTagService,
    addAudioToTagService,
} = require('./tags/tags.service');
const { removeWatchFolderMedia } = require('./watch-folders/watchFolders');
const { deleteThumbnail } = require('./thumbnail/thumbnail');
const { getCollectionDetailsById } = require('./database/collectionsDbService');
const appConfig = require('../configs/appConfig');
const { isNonEmptyString, isValidFileName, validateMediaId, validateMediaList } = require('./service-utils/ipcValidation');
const {
    updateAudioTitleService,
    updateAudioNsfwStatusService,
    renameAudioFileService,
    removeAudioFromLibrary,
    updateAudioNsfwStatus,
    resetAudiosMetaData,
} = require('./audio-library/audioLibrary.service');
const responseStatus = require('../constants/responseStatus');

const validateMediaServiceArgs = (mediaType, mediaId) => {
    if (!validateMediaId(mediaId)) {
        return respondError('Invalid media id provided');
    }

    if (![mediaTypes.VIDEO, mediaTypes.IMAGE].includes(mediaType)) {
        return respondError(`Unsupported media type: ${mediaType}`);
    }

    return null;
};

const validateRenameMediaServiceArgs = (mediaType, mediaId, oldFileName, newFileName) => {
    const validationError = validateMediaServiceArgs(mediaType, mediaId);
    if (validationError) {
        return validationError;
    }

    if (!isValidFileName(oldFileName) || !isValidFileName(newFileName)) {
        return respondError('Invalid file name provided for rename operation');
    }

    return null;
};

const validateInitiator = (initiator) => {
    if (!isNonEmptyString(initiator)) {
        return respondError('Invalid initiator provided');
    }

    return null;
};

const validateBulkMediaServiceArgs = (mediaList) => {
    if (!validateMediaList(mediaList)) {
        return respondError('Invalid media list provided');
    }

    return null;
};

/**
 * Updates the display title of a media item.
 * Dispatches to the correct service based on mediaType.
 *
 * @param {string} mediaType - 'video' or 'image'
 * @param {string} mediaId   - ID of the media item
 * @param {string} title     - New title to set
 * @returns {object} respondSuccess | respondError
 */
const updateMediaTitleService = (mediaType, mediaId, title) => {
    switch (mediaType) {
        case mediaTypes.VIDEO:
            return updateVideoTitleService(mediaId, title);
        case mediaTypes.IMAGE:
            return updateImageTitleService(mediaId, title);
        case mediaTypes.AUDIO:
            return updateAudioTitleService(mediaId, title);
        default:
            return respondError(`Unsupported media type: ${mediaType}`);
    }
};

/**
 * Toggles the NSFW flag on a media item.
 * Dispatches to the correct service based on mediaType.
 *
 * @param {string}  mediaType - 'video' or 'image'
 * @param {string}  mediaId   - ID of the media item
 * @param {boolean} isNsfw    - true to mark as NSFW, false to clear
 * @returns {object} respondSuccess | respondError
 */
const updateMediaNsfwStatusService = (mediaType, mediaId, isNsfw) => {
    switch (mediaType) {
        case mediaTypes.VIDEO:
            return updateVideoNsfwStatusService(mediaId, isNsfw);
        case mediaTypes.IMAGE:
            return updateImageNsfwStatusService(mediaId, isNsfw);
        case mediaTypes.AUDIO:
            return updateAudioNsfwStatusService(mediaId, isNsfw);
        default:
            return respondError(`Unsupported media type: ${mediaType}`);
    }
};

/**
 * Renames the physical file of a media item and updates the DB record.
 * Dispatches to the correct service based on mediaType.
 *
 * @param {string} mediaType    - 'video' or 'image'
 * @param {string} mediaId      - ID of the media item
 * @param {string} oldFileName  - Current file name
 * @param {string} newFileName  - Desired new file name
 * @returns {object} respondSuccess | respondError
 */
const renameMediaFileService = (mediaType, mediaId, oldFileName, newFileName) => {
    const validationError = validateRenameMediaServiceArgs(mediaType, mediaId, oldFileName, newFileName);
    if (validationError) {
        return validationError;
    }

    switch (mediaType) {
        case mediaTypes.VIDEO:
            return renameVideoFile(mediaId, oldFileName, newFileName);
        case mediaTypes.IMAGE:
            return renameImageFileService(mediaId, oldFileName, newFileName);
        case mediaTypes.AUDIO:
            return renameAudioFileService(mediaId, oldFileName, newFileName);
        default:
            return respondError(`Unsupported media type: ${mediaType}`);
    }
};

/**
 * Moves a media item from its current collection to a new one.
 * Updates the physical file path and the DB record.
 *
 * @param {object} args
 * @param {string} args.mediaType     - 'video' or 'image'
 * @param {string} args.mediaId       - ID of the media item
 * @param {object} args.newCollection - Target collection object with at least { id, label, year }
 * @returns {object} respondSuccess | respondError
 */
const changeMediaCollection = async (args) => {
    const { mediaType, mediaId, newCollection } = args;

    switch (mediaType) {
        case mediaTypes.VIDEO:
            try {
                await moveVideoFromOneCollectionToAnother(newCollection, mediaId);
                return respondSuccess(`Video ${mediaId} moved to collection ${newCollection.label}`);
            } catch (error) {
                return respondError(`Failed to move video ${mediaId} to collection ${newCollection.label}: ${error.message}`);
            }

        case mediaTypes.IMAGE:
            try {
                await moveImageFromOneCollectionToAnother(newCollection, mediaId);
                return respondSuccess(`Image ${mediaId} moved to collection ${newCollection.label}`);
            } catch (error) {
                return respondError(`Failed to move image ${mediaId} to collection ${newCollection.label}: ${error.message}`);
            }

        case mediaTypes.AUDIO:
            try {
                await moveAudioFromOneCollectionToAnother(newCollection, mediaId);
                return respondSuccess(`Image ${mediaId} moved to collection ${newCollection.label}`);
            } catch (error) {
                return respondError(`Failed to move image ${mediaId} to collection ${newCollection.label}: ${error.message}`);
            }

        default:
            return respondError(`Unsupported media type: ${mediaType}`);
    }
};

/**
 * Deletes a single library media item (video or image).
 * Publishes the appropriate inter-service events so that thumbnails,
 * previews, and the search index are cleaned up by their respective listeners.
 *
 * @param {object} args
 * @param {string} args.mediaType  - 'video' or 'image'
 * @param {string} args.mediaId    - ID of the media item
 * @param {string} args.initiator  - 'user' for normal delete, 'ENOENT' if the file is already gone from disk
 * @returns {object} respondSuccess | respondError
 */
const removeMediaService = async (mediaType, mediaId, initiator) => {
    const validationError = validateMediaServiceArgs(mediaType, mediaId) || validateInitiator(initiator);
    if (validationError) {
        return validationError;
    }

    switch (mediaType) {
        case mediaTypes.VIDEO:
            return removeVideoFromLibraryService(mediaId, initiator);

        case mediaTypes.IMAGE:
            try {
                const result = await removeImageFromLibrary(mediaId, initiator);
                return result.status === responseStatus.SUCCESS
                    ? respondSuccess(`Image ${mediaId} deleted`)
                    : respondError(`Failed to delete image ${mediaId}`);
            } catch (error) {
                return respondError(`Failed to delete image ${mediaId}: ${error}`);
            }
        case mediaTypes.AUDIO:
            try {
                const result = await removeAudioFromLibrary(mediaId, initiator);
                return result.status === responseStatus.SUCCESS
                    ? respondSuccess(`Image ${mediaId} deleted`)
                    : respondError(`Failed to delete image ${mediaId}`);
            } catch (error) {
                return respondError(`Failed to delete image ${mediaId}: ${error}`);
            }

        default:
            return respondError('Media type mismatch in deleting the media');
    }
};

/**
 * Creates a new tag and immediately associates the media item with it.
 *
 * @param {string} mediaType - 'video' or 'image'
 * @param {string} mediaId   - ID of the media item
 * @param {string} tagId     - ID for the new tag
 * @param {string} tagLabel  - Display label for the new tag
 * @returns {object} respondSuccess | respondError
 */
const addMediaToNewTagService = (mediaType, mediaId, tagId, tagLabel) => {
    switch (mediaType) {
        case mediaTypes.VIDEO:
            return addVideoToNewTagService(tagId, tagLabel, mediaId);
        case mediaTypes.IMAGE:
            return addImageToNewTagService(tagId, tagLabel, mediaId);
        case mediaTypes.AUDIO:
            return addAudioToNewTagService(tagId, tagLabel, mediaId);
        default:
            return respondError(`Unsupported media type: ${mediaType}`);
    }
};

/**
 * Removes the association between a media item and an existing tag.
 * Does not delete the tag itself.
 *
 * @param {string} mediaType - 'video' or 'image'
 * @param {string} mediaId   - ID of the media item
 * @param {string} tagId     - ID of the tag to remove from the media
 * @returns {Promise<object>} respondSuccess | respondError
 */
const removeMediaFromTagService = async (mediaType, mediaId, tagId) => {
    switch (mediaType) {
        case mediaTypes.VIDEO:
            return removeVideoFromTagService(tagId, mediaId);
        case mediaTypes.IMAGE:
            return removeImageFromTagService(tagId, mediaId);
        case mediaTypes.AUDIO:
            return removeAudioFromTagService(tagId, mediaId);

        default:
            return respondError(`Unsupported media type: ${mediaType}`);
    }
};

/**
 * Associates a media item with an existing tag.
 *
 * @param {string} mediaType - 'video' or 'image'
 * @param {string} mediaId   - ID of the media item
 * @param {string} tagId     - ID of the existing tag to add
 * @returns {Promise<object>} respondSuccess | respondError
 */
const addMediaToTagService = async (mediaType, mediaId, tagId) => {
    switch (mediaType) {
        case mediaTypes.VIDEO:
            return addVideoToTagService(tagId, mediaId);
        case mediaTypes.IMAGE:
            return addImageToTagService(tagId, mediaId);
        case mediaTypes.AUDIO:
            return addAudioToTagService(tagId, mediaId);
        default:
            return respondError(`Unsupported media type: ${mediaType}`);
    }
};

/**
 * Deletes a single library media item (video or image) as part of a bulk operation.
 * Removes the physical file (moved to trash), deletes the DB record, and publishes
 * DELETE_VIDEO / DELETE_IMAGE events so thumbnail, preview, and search index
 * cleanup is handled by their respective listeners.
 *
 * @param {object} media
 * @param {string} media.id        - ID of the media item
 * @param {string} media.mediaType - 'video' or 'image'
 * @returns {Promise<{ status: responseStatus.SUCCESS|'error', message: string }>}
 */
const _deleteSingleLibraryMediaService = async (media) => {
    const { mediaType, id: mediaId } = media;

    if (mediaType === mediaTypes.IMAGE) {
        const result = await removeImageFromLibrary(mediaId, 'user');
        return result.status === responseStatus.SUCCESS
            ? { status: responseStatus.SUCCESS, message: `Image ${mediaId} deleted` }
            : { status: 'error', message: `Failed to delete image ${mediaId}` };
    }

    if (mediaType === mediaTypes.VIDEO) {
        const result = await removeVideoFromLibrary(mediaId, 'user');

        return result.status === responseStatus.SUCCESS
            ? { status: responseStatus.SUCCESS, message: `Video ${mediaId} deleted` }
            : { status: 'error', message: `Video ${mediaId} cound not be deleted` };
    }

    if (mediaType === mediaTypes.AUDIO) {
        const result = await removeAudioFromLibrary(mediaId, 'user');
        return result.status === responseStatus.SUCCESS
            ? { status: responseStatus.SUCCESS, message: `Audio ${mediaId} deleted` }
            : { status: 'error', message: `Failed to delete audio ${mediaId}` };
    }

    return { status: 'error', message: `Unsupported media type: ${mediaType}` };
};

/**
 * Deletes a single watch folder media item as part of a bulk operation.
 * Permanently removes the physical file (no trash for watch folder items),
 * removes the DB record, and deletes the thumbnail directly.
 * Does NOT publish INDEX_DATA_CHANGED — watch folder media is not search-indexed.
 *
 * @param {object} media
 * @param {string} media.id         - ID of the media item
 * @param {string} media.mediaType  - 'video' or 'image'
 * @param {string} watchFolderId    - ID of the watch folder the media belongs to
 * @param {string} initiator        - 'user' for normal delete, 'INOENT' if the file is already gone
 * @returns {Promise<{ status: responseStatus.SUCCESS|'error', message: string }>}
 */
const _deleteSingleExternalMediaService = async (media, watchFolderId, initiator) => {
    const { id: mediaId } = media;

    if (!mediaId) {
        return { status: 'error', message: 'No mediaId provided' };
    }

    const isDeleted = await removeWatchFolderMedia(mediaId, watchFolderId, initiator);

    if (!isDeleted) {
        return { status: 'error', message: `Failed to remove media ${mediaId} from watch folder` };
    }

    await deleteThumbnail(mediaId);

    return { status: responseStatus.SUCCESS, message: `Media ${mediaId} removed from watch folder` };
};

/**
 * Deletes multiple media items serially — one at a time — so that each failure
 * is captured individually and the caller retains full control over the outcome.
 *
 * For library media:  file is moved to trash, DB record removed, search index updated.
 * For watch folder:   file is permanently deleted, DB record removed, thumbnail cleaned up.
 *
 * @param {Array<object>} mediaList         - Items to delete. Each item must have { id, mediaType }.
 *                                            Watch folder items must also have { watchFolderId? } (passed via collectionId).
 * @param {string}        collectionId      - For watch folder items, the watch folder ID.
 *                                            For library items this is unused (each item carries its own collection).
 * @param {boolean}       [isExternal=false] - true if the media belongs to a watch folder, false for library.
 * @returns {Promise<object>} respondSuccess | respondFailure | respondError
 *   - data.status:        responseStatus.SUCCESS | 'partial' | 'failed'
 *   - data.totalMedia:    number of items requested
 *   - data.mediaRemoved:  array of IDs that were successfully deleted
 *   - data.mediaFailed:   array of IDs that could not be deleted
 *   - data.errorDetails:  array of { mediaId, reason } for each failure
 */
const bulkRemoveMediaService = async (mediaList, collectionId, isExternal = false) => {
    const bulkValidationError = validateBulkMediaServiceArgs(mediaList);
    if (bulkValidationError) {
        return bulkValidationError;
    }

    const result = {
        status: '',
        totalMedia: mediaList.length,
        mediaRemoved: [],
        mediaFailed: [],
        errorDetails: [],
    };
    try {
        for (const item of mediaList) {
            const itemResult = isExternal
                ? await _deleteSingleExternalMediaService(item, collectionId, 'user')
                : await _deleteSingleLibraryMediaService(item, 'user');

            if (itemResult.status === 'error') {
                result.mediaFailed.push(item.id);
                result.errorDetails.push({ mediaId: item.id, reason: itemResult.message });
            } else {
                result.mediaRemoved.push(item.id);
            }
        }

        const allFailed = result.mediaFailed.length === mediaList.length;
        const allSucceeded = result.mediaRemoved.length === mediaList.length;

        result.status = allSucceeded ? responseStatus.SUCCESS : allFailed ? 'failed' : 'partial';

        if (allFailed) {
            return respondFailure('Bulk media delete failed — no items were removed', result);
        }

        return respondSuccess('Media deleted successfully', result);
    } catch (error) {
        return respondError(`Failed to delete media: ${error.message}`);
    }
};

/**
 * Updates the NSFW flag on a single media item without a respondSuccess/respondError wrapper.
 * Used internally by bulkMediaNsfwStatusService so the bulk loop stays synchronous and simple.
 *
 * @param {string}  mediaId   - ID of the media item
 * @param {string}  mediaType - 'video' or 'image'
 * @param {boolean} isNsfw    - true to mark as NSFW, false to clear
 * @returns {{ status: responseStatus.SUCCESS|'error', message: string }}
 */
const _updateSingleMediaNsfwStatus = (mediaId, mediaType, isNsfw) => {
    try {
        if (mediaType === mediaTypes.VIDEO) {
            const updated = updateVideoNsfwStatus(mediaId, isNsfw);
            return updated
                ? { status: responseStatus.SUCCESS, message: `Video ${mediaId} NSFW status updated` }
                : { status: responseStatus.ERROR, message: `Video ${mediaId} was not updated — no matching record` };
        }

        if (mediaType === mediaTypes.IMAGE) {
            const updated = updateImageNsfwStatus(mediaId, isNsfw);
            return updated !== null && updated.status === responseStatus.SUCCESS
                ? { status: responseStatus.SUCCESS, message: `Image ${mediaId} NSFW status updated` }
                : { status: 'error', message: `Image ${mediaId} was not updated — no matching record` };
        }

        if (mediaType === mediaTypes.AUDIO) {
            const updated = updateAudioNsfwStatus(mediaId, isNsfw);
            return updated !== null && updated.status === responseStatus.SUCCESS
                ? { status: responseStatus.SUCCESS, message: `Audio ${mediaId} NSFW status updated` }
                : { status: 'error', message: `Audio ${mediaId} was not updated — no matching record` };
        }

        return { status: 'error', message: `Unsupported media type: ${mediaType}` };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
};

/**
 * Updates the NSFW flag on multiple media items serially.
 * Each failure is captured individually; the rest continue.
 *
 * @param {Array<object>} mediaList  - Items to update. Each must have { id, mediaType }.
 * @param {boolean}       isNsfw     - true to mark as NSFW, false to clear.
 * @returns {Promise<object>} respondSuccess | respondFailure | respondError
 *   - data.status:        responseStatus.SUCCESS | 'partial' | 'failed'
 *   - data.totalMedia:    number of items requested
 *   - data.mediaUpdated:  array of IDs successfully updated
 *   - data.mediaFailed:   array of IDs that could not be updated
 *   - data.errorDetails:  array of { mediaId, reason } for each failure
 */
const bulkMediaNsfwStatusService = async (mediaList, isNsfw) => {
    const result = {
        status: '',
        totalMedia: mediaList.length,
        mediaUpdated: [],
        mediaFailed: [],
        errorDetails: [],
    };

    try {
        for (const item of mediaList) {
            const { id: mediaId, mediaType } = item;
            const itemResult = _updateSingleMediaNsfwStatus(mediaId, mediaType, isNsfw);

            if (itemResult.status === 'error') {
                result.mediaFailed.push(mediaId);
                result.errorDetails.push({ mediaId, reason: itemResult.message });
            } else {
                result.mediaUpdated.push(mediaId);
            }
        }

        const allFailed = result.mediaFailed.length === mediaList.length;
        const allSucceeded = result.mediaUpdated.length === mediaList.length;

        result.status = allSucceeded ? responseStatus.SUCCESS : allFailed ? 'failed' : 'partial';

        if (allFailed) {
            return respondFailure('Bulk NSFW status update failed — no items were updated', result);
        }

        return respondSuccess('NSFW status updated successfully', result);
    } catch (error) {
        return respondError(`Failed to update NSFW status: ${error.message}`);
    }
};
/**
 * bulkMediaCategoryService is applicable for videos only. Images and audios do not have category attribution.
 * @param {*} mediaList
 * @param {*} categoryId
 * @returns
 */
const bulkMediaCategoryService = async (mediaList, categoryId) => {
    const result = { status: '', totalMedia: mediaList.length, mediaUpdated: [], mediaFailed: [], errorDetails: [] };
    try {
        for (const item of mediaList) {
            if (item.mediaType !== mediaTypes.VIDEO) continue;
            try {
                const updated = updateVideoCategory(item.id, categoryId);
                if (updated) result.mediaUpdated.push(item.id);
                else result.mediaFailed.push(item.id);
            } catch (err) {
                result.mediaFailed.push(item.id);
                result.errorDetails.push({ mediaId: item.id, reason: err.message });
            }
        }
        const allFailed = result.mediaFailed.length === mediaList.length;
        result.status = result.mediaUpdated.length === mediaList.length ? responseStatus.SUCCESS : allFailed ? 'failed' : 'partial';
        return allFailed ? respondFailure('Bulk category update failed', result) : respondSuccess('Category updated successfully', result);
    } catch (error) {
        return respondError(`Failed to update category: ${error.message}`);
    }
};

const bulkMediaCollectionChangeService = async (mediaList, newCollectionId) => {
    const bulkValidationError = validateBulkMediaServiceArgs(mediaList);
    if (bulkValidationError) {
        return bulkValidationError;
    }

    if (!isNonEmptyString(newCollectionId)) {
        return respondError('Target collection id is required');
    }

    const result = {
        status: '',
        totalMedia: mediaList.length,
        mediaUpdated: [],
        mediaFailed: [],
        errorDetails: [],
    };

    try {
        // Check how many items the target collection already holds
        const targetCollection = getCollectionDetailsById(newCollectionId);
        if (!targetCollection) {
            return respondError(`Target collection not found: ${newCollectionId}`);
        }

        const currentCount = targetCollection.mediaCount || 0;
        const availableSlots = appConfig.MAX_MEDIA_PER_COLLECTION - currentCount;

        for (const item of mediaList) {
            // If target collection is at capacity, mark remaining as failed
            if (result.mediaUpdated.length >= availableSlots) {
                result.mediaFailed.push(item.id);
                result.errorDetails.push({
                    mediaId: item.id,
                    reason: `collection_limit_reached`,
                });
                continue;
            }

            try {
                if (item.mediaType === mediaTypes.VIDEO) {
                    await moveVideoFromOneCollectionToAnother(targetCollection, item.id);
                } else if (item.mediaType === mediaTypes.IMAGE) {
                    await moveImageFromOneCollectionToAnother(targetCollection, item.id);
                } else if (item.mediaType === mediaTypes.AUDIO) {
                    await moveAudioFromOneCollectionToAnother(targetCollection, item.id);
                } else {
                    throw new Error(`Unsupported media type: ${item.mediaType}`);
                }
                result.mediaUpdated.push(item.id);
            } catch (err) {
                result.mediaFailed.push(item.id);
                result.errorDetails.push({ mediaId: item.id, reason: err.message });
            }
        }

        const allFailed = result.mediaFailed.length === mediaList.length;
        result.status = result.mediaUpdated.length === mediaList.length ? responseStatus.SUCCESS : allFailed ? 'failed' : 'partial';
        return allFailed ? respondFailure('Bulk collection move failed', result) : respondSuccess('Collection move completed', result);
    } catch (error) {
        return respondError(`Failed to move media to collection: ${error.message}`);
    }
};

const bulkMediaMetaDataResetService = async (mediaList, metaDataList = []) => {
    // ignore the metaDataList as of now. This is for future implementation.

    // group all images and videos in to separate arrays
    const imageIds = [];
    const videoIds = [];
    const audioIds = [];

    for (const media of mediaList) {
        if (media.mediaType === mediaTypes.IMAGE) {
            imageIds.push(media.id);
        } else if (media.mediaType === mediaTypes.VIDEO) {
            videoIds.push(media.id);
        } else if (media.mediaType === mediaTypes.AUDIO) {
            audioIds.push(media.id);
        }
    }

    try {
        // update images first
        if (imageIds.length > 0) {
            resetImagesMetaData(imageIds, metaDataList);
        }

        if (audioIds.length > 0) {
            resetAudiosMetaData(audioIds, metaDataList);
        }

        // update videos next
        if (videoIds.length > 0) {
            resetVideosMetaData(videoIds, metaDataList);
        }

        return respondSuccess('Media metadata reset completed successfully');
    } catch (error) {
        return respondError(`${error.message}`);
    }
};

module.exports = {
    updateMediaTitleService,
    updateMediaNsfwStatusService,
    renameMediaFileService,
    changeMediaCollection,
    removeMediaService,
    addMediaToNewTagService,
    removeMediaFromTagService,
    addMediaToTagService,
    bulkRemoveMediaService,
    bulkMediaNsfwStatusService,
    bulkMediaCategoryService,
    bulkMediaCollectionChangeService,
    bulkMediaMetaDataResetService,
};
