const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const path = require('path');
const { getLibDir, getTrashBinPath, getPreviewDir } = require('../servicePathConfig');
const { removeFile } = require('../service-utils/fileUtils');
const fse = require('fs-extra');
const { generateVideoPreview } = require('../service-utils/generateVideoPreview');
const { logLibraryError } = require('../logs/logService');
const userPreferenceStore = require('../../main/userPreferenceStore');

const {
    addVideo,
    getVideoDetailsById,
    checkForDuplicate,
    getAllVideoIds,
    updateVideoDetails,
    getAllVideos,
    deleteVideo,
    initializeDb,
    getVideoIdsWithoutPreview,
    updateHasPreviewStatus,

    updateCategory,
    resetVideosTitleAndCategory,
} = require('../database/videoLibraryDbService');
const { addCollection, doesCollectionExists } = require('../database/collectionsDbService');
const { getRelativeMediaPath, getAbsoluteMediaPath } = require('../service-utils/mediaPath');

const { resetMetaData } = require('../database/metaDataDbService');
const responseStatus = require('../../constants/responseStatus');
const mediaTypes = require('../../constants/mediaTypes');
const { addMediaLocation } = require('../location/location');

const onImportFileSuccess = (data) => {
    if (data.mediaType !== mediaTypes.VIDEO) return;
    const videoStats = Object.assign({}, data.completedMediaStats);

    const collectionExists = doesCollectionExists(videoStats.collection_id);

    if (!collectionExists) {
        addCollection(videoStats.collection_id, videoStats.coll, videoStats.year);
    }

    const doesVideoExist = checkForDuplicate(videoStats.id);
    if (!doesVideoExist) {
        addVideo(videoStats);
        if (videoStats.latitude && videoStats.longitude) {
            addMediaLocation(mediaTypes.VIDEO, videoStats.id, videoStats.latitude, videoStats.longitude);
        }
    }
};

const getVideoFullPath = (videoPath = '') => {
    const finalPath = path.join(getLibDir(), videoPath);
    return finalPath;
};

const getRelativeFolderPath = (videoPath = '') => videoPath.slice(0, videoPath.lastIndexOf('/'));

/**
 * Updates the video details in the library by ID.
 *
 * @param {string} id - The unique identifier of the video to update.
 * @param {object} updateDetails - An object containing the details to update.
 * @returns {void}
 *
 * @example
 * updateVideoDetailsById('video123', { duration: 120 });
 */
const updateVideoDetailsById = (id = '', updateDetails = {}) => {
    if (id !== '') {
        const videoData = getVideoDetailsById(id);
        if (videoData !== null) {
            updateVideoDetails({ ...videoData, ...updateDetails });
        }
    }
};

const udpateVideoTitle = (id = '', title = '') => {
    if (id !== '') {
        const videoData = getVideoDetailsById(id);
        if (videoData !== null) {
            return updateVideoDetails({ ...videoData, ...{ title: title } });
        }
    } else {
        return null;
    }
};

const updateNsfwStatus = (id = '', isNsfw = false) => {
    if (id !== '') {
        const videoData = getVideoDetailsById(id);
        // update is_nsfw field with isNsfw data with 0 or 1 based on false or true.
        return updateVideoDetails({ ...videoData, is_nsfw: isNsfw ? 1 : 0 });
    } else {
        return null;
    }
};

/**
 * rename the video file name and updates the video details in the library.
 */
const renameVideoFile = async (videoId = '', oldFileName = '', newFileName = '') => {
    const videoData = getVideoDetailsById(videoId);
    if (videoData === null) {
        return {
            status: responseStatus.ERROR,
            message: `Video not found for id: ${videoId}`,
        };
    }

    if (videoData.name !== oldFileName) {
        return {
            status: responseStatus.ERROR,
            message: `Video rename rejected because stored file name does not match ${oldFileName}`,
        };
    }

    const uniqueIDPrefix = `_${videoId}_`;
    const uniqueNewFileName = uniqueIDPrefix + newFileName;
    const absoluteExistingVideoFilePath = getVideoFullPath(videoData.path);
    const newPath = path.join(getRelativeFolderPath(videoData.path), uniqueNewFileName);
    const absoluteNewVideoFilePath = getVideoFullPath(newPath);

    try {
        await fse.move(absoluteExistingVideoFilePath, absoluteNewVideoFilePath);
        ((videoData.name = newFileName), (videoData.path = newPath), updateVideoDetails(videoData));
        return {
            status: responseStatus.SUCCESS,
            message: 'File name updated successfully',
        };
    } catch (error) {
        return {
            status: responseStatus.ERROR,
            message: `Failed to rename video file for ${videoId}`,
        };
    }
};

/**
 * Make this function async
 *
 * @param videosList
 */
const deleteVideoDetails = async (videoId = '') => {
    if (videoId === '' || !videoId) {
        return false;
    }

    const videoData = getVideoDetailsById(videoId);

    const deleteDbStatus = deleteVideo(videoId);
    if (deleteDbStatus) {
        const deleteFileStatus = await removeFile(getVideoFullPath(videoData.path), getTrashBinPath());
        return deleteFileStatus.status === responseStatus.SUCCESS;
    }
};

/**
 * Moves a video file to a specified destination directory and updates the video details in the library.
 *
 * @param {string} destinationCollection - The path of the destination directory where the video file will be moved.
 * @param {string} videoDetails - The unique identifier of the video to move.
 * @returns {Promise<void>} A promise that resolves when the video file is moved and the library is updated.
 *
 * @example
 * moveVideo('/path/to/destination', 'video123');
 */
const moveVideo = async (videoId = '', newCollection = {}) => {
    const videoDetails = getVideoDetailsById(videoId);

    if (videoDetails) {
        const libraryDirectory = getLibDir();
        const fileName = videoDetails.path.split('/').pop();

        const newPath = path.join('' + newCollection.year, newCollection.label, fileName);

        const fullQualifiedDestPath = path.join(libraryDirectory, newPath);
        const sourceVideoPath = path.join(libraryDirectory, videoDetails.path);
        await fse.move(sourceVideoPath, fullQualifiedDestPath);

        const oldCollectionId = videoDetails.collection_id;
        const newCollectionId = newCollection.id;

        updateVideoDetailsById(videoId, { path: newPath, collection_id: newCollection.id });
        serviceEventBus.publish(interServiceEvents.VIDEO_COLLECTION_CHANGE, { newCollectionId, oldCollectionId });
    }
};

const importVideoFromWatchedDirectory = async (videoDetails, destinationCollection) => {
    if (videoDetails.id && destinationCollection.id) {
        const fileName = videoDetails.name;
        const relativeVideoPath = getRelativeMediaPath(destinationCollection.year, destinationCollection.label, fileName, videoDetails.id);

        const destinationVideoPath = getAbsoluteMediaPath(relativeVideoPath);

        const sourceVideoPath = videoDetails.path;

        try {
            await fse.move(sourceVideoPath, destinationVideoPath);

            const newMediaStats = {
                id: videoDetails.id,
                name: videoDetails.name,
                birthtimeMs: parseInt(videoDetails.birthtimeMs),
                path: relativeVideoPath,
                coll: destinationCollection.label,
                collection_id: destinationCollection.id,
                year: destinationCollection.year,
                title: '',
                size: videoDetails.size,
                duration: videoDetails.duration || 0,
                watchFolderId: videoDetails.watchFolderId,
            };

            serviceEventBus.publish(interServiceEvents.IMPORT_FILE_SUCCESS, {
                completedMediaStats: newMediaStats,
                mediaType: mediaTypes.VIDEO,
            });

            if (userPreferenceStore.get('showVideoPreviewOnHover')) {
                try {
                    const previewPath = await generateVideoPreview({
                        videoPath: destinationVideoPath,
                        previewFolder: getPreviewDir(),
                        videoId: videoDetails.id,
                    });
                    if (previewPath) {
                        updateHasPreviewStatus(videoDetails.id, true);
                    }
                } catch (previewErr) {
                    logLibraryError(`Failed to generate preview during import for videoId: ${videoDetails.id}: ${previewErr.message}`);
                }
            }

            return Promise.resolve({
                status: responseStatus.SUCCESS,
                data: {
                    videoDetails: newMediaStats,
                },
            });
        } catch (err) {
            serviceEventBus.publish(interServiceEvents.IMPORT_FILE_FAILURE, {
                videoDetails: videoDetails,
                message: `Failed to import video`,
                error: err,
            });
            return Promise.reject({
                status: responseStatus.ERROR,
                data: {
                    videoDetails: videoDetails,
                    error: err,
                },
            });
        }
    } else {
        throw new Error('videoDetails or new collection is not well defined');
    }
};

const resetVideosMetaData = (videoIds) => {
    if (!Array.isArray(videoIds)) {
        throw new Error('videoIds must be arrays');
    }

    resetVideosTitleAndCategory(videoIds);
    resetMetaData(videoIds);

    return true;
};

const initVideoLibraryService = () => {
    initializeDb();
    serviceEventBus.subscribe(interServiceEvents.IMPORT_FILE_SUCCESS, (data) => onImportFileSuccess(data));
};

module.exports = {
    initVideoLibraryService,

    // read operations
    getAllVideos,
    getAllVideoIds,
    checkForDuplicate,
    getVideoDetailsById,
    getVideoIdsWithoutPreview,

    // write operations
    moveVideo,
    resetVideosMetaData,
    udpateVideoTitle,
    renameVideoFile,
    updateNsfwStatus,
    deleteVideoDetails,
    importVideoFromWatchedDirectory,
    updateVideoCategory: updateCategory,
};
