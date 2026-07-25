const interServiceEvents = require('../../events/interServiceEvents');
const { respond, respondSuccess } = require('../service-utils/sendToUI');
const {
    initImageLibraryService,
    getFullImageDetailsById,
    getAllImageIds,
    deleteImageDetails,
    moveImage,
    importImageFromWatchedDirectory,
    updateImageTitle,
    updateImageNsfwStatus,
    renameImageFile,
    resetImagesMetaData,
} = require('./imageLibrary');
const serviceEventBus = require('../service-utils/serviceEventBus');
const indexingEvents = require('../../events/indexingEvents');

const getImageDetailsService = (imageId) => {
    const imageDetails = getImageDetailsById(imageId);
    return respondSuccess('imageDetails', imageDetails);
};

const getAllImageIdsService = () => {
    return respondSuccess('imageIds', getAllImageIds());
};

const updateImageTitleService = (imageId, title) => {
    try {
        const updatedImageDetails = updateImageTitle(imageId, title);

        return respondSuccess('Title updated successfully', updatedImageDetails);
    } catch (error) {
        return respond('error', `system error while updating. ${error.message}`);
    }
};

const updateImageNsfwStatusService = (imageId, isNsfw) => {
    try {
        const updatedImageDetails = updateImageNsfwStatus(imageId, isNsfw);
        return respondSuccess('NSFW status updated successfully', updatedImageDetails);
    } catch (error) {
        return respond('error', `system error while updating. ${error.message}`);
    }
};

const renameImageFileService = (imageId, oldFileName, newFileName) => {
    return renameImageFile(imageId, oldFileName, newFileName);
};

const getFullImageDetailsService = (imageId) => {
    try {
        const imageDetails = getFullImageDetailsById(imageId);

        return respondSuccess('imageDetails', imageDetails);
    } catch (error) {
        return respond('error', `system error while getting image details. ${error.message}`);
    }
};

/**
 * Deletes a single library image.
 *   - 'user' initiator: removes the physical file (moved to trash) and DB record,
 *     then publishes DELETE_IMAGE (thumbnail cleanup) and INDEX_DATA_CHANGED (search index update).
 *   - 'ENOENT' initiator: file is already gone from disk — skips physical deletion,
 *     removes only the DB record and triggers reindexing.
 *
 * Returns a plain { status, imageId } — no respond* wrapping — so it can be consumed
 * directly by removeMediaService (single) and _deleteSingleLibraryMediaService (bulk).
 * The looping responsibility belongs to the caller in commonMediaService.
 *
 * @param {string} imageId   - ID of the image to delete
 * @param {string} initiator - 'user' | 'ENOENT'
 * @returns {Promise<{ status: 'success'|'failed', imageId: string }>}
 */
const removeImageFromLibrary = async (imageId, initiator) => {
    if (initiator !== 'ENOENT') {
        // User intentionally deleted the image — remove the physical file (moved to trash)
        // and DB record, then signal the rest of the app that this image no longer exists.
        const isDeleteSuccess = await deleteImageDetails(imageId);

        if (!isDeleteSuccess) {
            return { status: 'failed', imageId };
        }
    }

    // File already gone from disk (ENOENT), or user delete succeeded —
    // publish events so thumbnail and search index are cleaned up.
    serviceEventBus.publish(interServiceEvents.DELETE_IMAGE, { imageId });
    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.IMAGE_DELETE, imageId });

    return { status: 'success', imageId };
};

module.exports = {
    initImageLibraryService,
    getFullImageDetailsService,
    getImageDetailsService,
    getAllImageIdsService,
    deleteImageDetails,
    removeImageFromLibrary,
    moveImage,
    importImageFromWatchedDirectory,
    updateImageTitleService,
    updateImageNsfwStatusService,
    updateImageNsfwStatus,
    renameImageFileService,
    resetImagesMetaData,
};
