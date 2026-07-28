const path = require('path');
const fse = require('fs-extra');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { getLibDir, getTrashBinPath, getThumbnailsDir } = require('../servicePathConfig');
const { removeFile } = require('../service-utils/fileUtils');
const { getRelativeMediaPath, getAbsoluteMediaPath } = require('../service-utils/mediaPath');
const { doesCollectionExists, addCollection } = require('../database/collectionsDbService');
const {
    initializeDb,
    checkForDuplicateImage,
    addImage,
    getAllImageIds: getAllImageIdsFromDb,
    getImageDetailsById,
    updateImageDetails,
    deleteImageFromDb,
    updateDescriptionAndEmbedding,
    getImageDescriptionById,
    resetImagesMetaData,
} = require('../database/imageLibraryDbService');
const { getHiddenCollectionIds } = require('../collections/collections');
const mediaTypes = require('../../constants/mediaTypes');
const { getTagsByImageId } = require('../database/tagsDbService');
const { MAX_SHORT_DESCRIPTION_LENGTH } = require('../../configs/appConfig');
const indexingEvents = require('../../events/indexingEvents');
const responseStatus = require('../../constants/responseStatus');

const updateImageDetailsById = (id = '', udpatedDetails = {}) => {
    if (id !== '') {
        const imageData = getImageDetailsById(id);
        if (imageData !== null) {
            updateImageDetails({ ...imageData, ...udpatedDetails });
        }
    }
    return true;
};

const getAllImageIds = () => {
    return getAllImageIdsFromDb() || [];
};

const getImageFullPath = (imagePath = '') => {
    return path.join(getLibDir(), imagePath);
};

const getRelativeFolderPath = (mediaPath = '') => mediaPath.slice(0, mediaPath.lastIndexOf('/'));

const moveImage = async (imageId = '', newCollection = {}) => {
    const imageDetails = getImageDetailsById(imageId);

    if (!imageDetails) {
        return null;
    }

    const libraryDirectory = getLibDir();
    const fileName = imageDetails.path.split('/').pop();
    const newPath = path.join('' + newCollection.year, newCollection.label, fileName);

    const fullQualifiedDestPath = path.join(libraryDirectory, newPath);
    const sourceImagePath = path.join(libraryDirectory, imageDetails.path);

    await fse.move(sourceImagePath, fullQualifiedDestPath);

    const oldCollectionId = imageDetails.collection_id;
    const newCollectionId = newCollection.id;

    updateImageDetailsById(imageId, {
        path: newPath,
        collection_id: newCollection.id,
    });

    serviceEventBus.publish(interServiceEvents.VIDEO_COLLECTION_CHANGE, {
        newCollectionId,
        oldCollectionId,
    });

    return getImageDetailsById(imageId);
};

const deleteImageDetails = async (imageId = '', initiator = 'user') => {
    if (!imageId) {
        return {
            status: responseStatus.ERROR,
            message: 'imageId not found',
        };
    }
    const imageData = getImageDetailsById(imageId);

    if (imageData === null) {
        return {
            status: responseStatus.FAILURE,
            message: 'Image details not found',
        };
    }

    if (initiator !== 'ENOENT') {
        // User intentionally deleted the image — remove the physical file (moved to trash)
        // and DB record, then signal the rest of the app that this image no longer exists.
        const removeFileAction = await removeFile(getImageFullPath(imageData.path), getTrashBinPath());
        if (removeFileAction.code && removeFileAction.code !== 'ENOENT') {
            throw new Error(`Error removing file for image: ${imageId}, error: ${removeFileAction.message}`);
        }
        serviceEventBus.publish(interServiceEvents.DELETE_IMAGE, { imageId });

        const deleteDbStatus = deleteImageFromDb(imageId);

        if (!deleteDbStatus) {
            throw new Error(`Error deleting image from DB: ${imageId}`);
        }
    } else {
        serviceEventBus.publish(interServiceEvents.DELETE_IMAGE, { imageId });

        // ENOENT — this image was deleted from disk by another process,
        // so we just remove the DB record and trigger reindexing.
        const isDeleteSuccess = deleteImageFromDb(imageId);

        if (!isDeleteSuccess) {
            return { status: responseStatus.FAILURE, imageId };
        }
    }

    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.IMAGE_DELETE, imageId });

    return { status: responseStatus.SUCCESS, imageId };
};

const importImageFromWatchedDirectory = async (mediaDetails, destinationCollection) => {
    if (!mediaDetails?.id || !destinationCollection?.id) {
        throw new Error('mediaDetails or destination collection is not well defined');
    }

    const fileName = mediaDetails.name;
    const relativeImagePath = getRelativeMediaPath(destinationCollection.year, destinationCollection.label, fileName, mediaDetails.id);

    const destinationImagePath = getAbsoluteMediaPath(relativeImagePath);
    const sourceImagePath = mediaDetails.path;

    try {
        await fse.move(sourceImagePath, destinationImagePath);

        const newImageStats = {
            id: mediaDetails.id,
            name: mediaDetails.name,
            birthtimeMs: mediaDetails.birthtimeMs,
            path: relativeImagePath,
            coll: destinationCollection.label,
            collection_id: destinationCollection.id,
            year: destinationCollection.year,
            title: '',
            size: mediaDetails.size,
            duration: null,
            watchFolderId: mediaDetails.watchFolderId,
            mediaType: mediaTypes.IMAGE,
        };

        serviceEventBus.publish(interServiceEvents.IMPORT_FILE_SUCCESS, {
            completedMediaStats: newImageStats,
            mediaType: mediaTypes.IMAGE,
        });

        return {
            status: responseStatus.SUCCESS,
            data: {
                imageDetails: newImageStats,
            },
        };
    } catch (err) {
        serviceEventBus.publish(interServiceEvents.IMPORT_FILE_FAILURE, {
            imageDetails: mediaDetails,
            message: 'Failed to import image',
            error: err,
        });

        throw {
            status: responseStatus.ERROR,
            data: {
                imageDetails: mediaDetails,
                error: err,
            },
        };
    }
};

const renameImageFile = async (imageId = '', oldFileName = '', newFileName = '') => {
    if (imageId === '' || oldFileName === '' || newFileName === '') {
        return {
            status: responseStatus.ERROR,
            message: 'imageId, oldFileName and newFileName are required',
        };
    }

    const imageData = getImageDetailsById(imageId);

    if (imageData === null) {
        return {
            status: responseStatus.ERROR,
            message: `Image not found for id: ${imageId}`,
        };
    }

    if (imageData.name !== oldFileName) {
        return {
            status: responseStatus.ERROR,
            message: `Image rename rejected because stored file name does not match ${oldFileName}`,
        };
    }

    const uniqueIDPrefix = `_${imageId}_`;
    const uniqueNewFileName = uniqueIDPrefix + newFileName;
    const absoluteExistingImageFilePath = getImageFullPath(imageData.path);
    const newPath = path.join(getRelativeFolderPath(imageData.path), uniqueNewFileName);
    const absoluteNewImageFilePath = getImageFullPath(newPath);

    try {
        await fse.move(absoluteExistingImageFilePath, absoluteNewImageFilePath);
        ((imageData.name = newFileName), (imageData.path = newPath), updateImageDetails(imageData));
        return {
            status: responseStatus.SUCCESS,
            message: 'File name updated successfully',
        };
    } catch (error) {
        console.error(`Error renaming file for imageId: ${imageId}, error: ${error}`);
        return {
            status: 'error',
            message: `Failed to rename image file for ${imageId}`,
        };
    }
};

const updateImageNsfwStatus = (imageId = '', isNsfw = false) => {
    if (imageId === '') {
        return null;
    }
    try {
        updateImageDetailsById(imageId, {
            is_nsfw: isNsfw ? 1 : 0,
        });

        return {
            status: responseStatus.SUCCESS,
            data: getImageDetailsById(imageId),
        };
    } catch (error) {
        return {
            status: responseStatus.ERROR,
            message: `System error while updating. ${error.message}`,
        };
    }
};

const updateImageTitle = (id = '', title = '') => {
    if (id !== '') {
        const imageData = getImageDetailsById(id);

        if (imageData !== null) {
            updateImageDetails({ ...imageData, ...{ title: title } });
            serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
                mediaType: mediaTypes.IMAGE,
                change: indexingEvents.IMAGE_TITLE_CHANGE,
                mediaId: id,
            });
            return _getImageDetailsById(id);
        }
    }

    return null;
};

const onImportFileSuccess = (data) => {
    if (data.mediaType !== mediaTypes.IMAGE) return;

    const mediaStats = Object.assign({}, data.completedMediaStats);

    const collectionExists = doesCollectionExists(mediaStats.collection_id);

    if (!collectionExists) {
        addCollection(mediaStats.collection_id, mediaStats.coll, mediaStats.year);
    }

    const doesImageExist = checkForDuplicateImage(mediaStats.id);
    if (doesImageExist) {
        console.warn(`Skipping duplicate image on import: ${mediaStats.id} (${mediaStats.name})`);
        return;
    }

    try {
        addImage(mediaStats);
    } catch (err) {
        // Treat duplicates as a non-fatal skip — any other error is logged for investigation.
        if (err.message?.includes('Duplicate ID')) {
            console.warn(`Skipping duplicate image on import: ${mediaStats.id} (${mediaStats.name})`);
        } else {
            console.error(`Failed to import image ${mediaStats.id} (${mediaStats.name}): ${err.message}`);
            throw err;
        }
    }
};

const _getImageDetailsById = (imageId = '') => {
    if (imageId === undefined) {
        throw new Error('Invalid imageId', imageId);
    }
    let imageDetails = getImageDetailsById(imageId);

    const hiddenCollections = getHiddenCollectionIds();

    if (imageDetails !== null) {
        return {
            thumbnailURL: path.join(getThumbnailsDir(), `${imageId}.jpg`),
            id: imageDetails.id,
            name: imageDetails.name,
            collection: imageDetails.coll,
            collectionId: imageDetails.collection_id,
            path: imageDetails.path,
            size: imageDetails.size,
            birthtimeMs: imageDetails.birthtimeMs,
            title: imageDetails.title,
            isHidden: hiddenCollections.has(imageDetails.collection_id),
            isNsfw: imageDetails.is_nsfw,
            source: imageDetails.source,
            mediaType: mediaTypes.IMAGE,
        };
    } else {
        // TODO : if null is comming apply for data reindexing
        console.error('null data is persisting, clean call please', imageId);
        return null;
    }
};

const getFullImageDetailsById = (imageId = '') => {
    const imageDetails = _getImageDetailsById(imageId);

    if (!imageDetails) {
        return null;
    }

    const tags = getTagsByImageId(imageId);
    const description = getImageDescriptionById(imageId);

    const shortDesc = description ? description.slice(0, MAX_SHORT_DESCRIPTION_LENGTH) : '';

    return {
        ...imageDetails,
        tags,
        shortDesc,
    };
};

const updateImageMetaData = (id, description = '', embedding = '') => {
    try {
        updateDescriptionAndEmbedding(id, description, embedding);
        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
            mediaType: mediaTypes.IMAGE,
            change: indexingEvents.IMAGE_META_DATA_CHANGE,
            mediaId: id,
        });
        return true;
    } catch (error) {
        return false;
    }
};

const initImageLibraryService = () => {
    initializeDb();
    serviceEventBus.subscribe(interServiceEvents.IMPORT_FILE_SUCCESS, (data) => onImportFileSuccess(data));
};

module.exports = {
    initImageLibraryService,
    getBasicImageDetailsById: _getImageDetailsById,
    getFullImageDetailsById,
    getAllImageIds,
    addImage,
    updateImageDetailsById,
    updateImageTitle,
    updateImageNsfwStatus,
    deleteImageDetails,
    moveImage,
    renameImageFile,
    importImageFromWatchedDirectory,
    updateImageMetaData,
    resetImagesMetaData,
};
