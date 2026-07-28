const { respond, respondSuccess, respondError } = require('../service-utils/sendToUI');
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

const responseStatus = require('../../constants/responseStatus');

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
 * @param {string} imageId   - ID of the image to delete
 * @param {string} initiator - 'user' | 'ENOENT'
 * @returns {Promise<{ status: 'success'|'failed', imageId: string }>}
 */
const removeImageFromLibraryService = async (imageId, initiator) => {
    try {
        const deleteAction = await deleteImageDetails(imageId, initiator);

        if (deleteAction.status === responseStatus.SUCCESS) {
            return respondSuccess('Image deleted successfully', deleteAction.imageId);
        } else {
            return respondFailure('Failed to delete image', deleteAction.message);
        }
    } catch (error) {
        return respondError(`Error: ${error.message}`);
    }
};

module.exports = {
    initImageLibraryService,
    getFullImageDetailsService,
    getImageDetailsService,
    getAllImageIdsService,
    deleteImageDetails,
    removeImageFromLibraryService,
    moveImage,
    importImageFromWatchedDirectory,
    updateImageTitleService,
    updateImageNsfwStatusService,
    updateImageNsfwStatus,
    renameImageFileService,
    resetImagesMetaData,
};
