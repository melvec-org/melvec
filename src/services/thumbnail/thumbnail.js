const { doesFileExistAsync, writeFile, removeFile } = require('../service-utils/fileUtils');
const { getThumbnailsDir, getPreviewDir } = require('../servicePathConfig');
const path = require('path');

const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');

const mediaTypes = require('../../constants/mediaTypes');
const { generateImageThumbnail } = require('../service-utils/generateImageThumbnail');
/*
 * @param videoList
 * @returns {Promise<[]>}
 */
const getThumbnailIntegrityStatus = async (videoList = []) => {
    const failedItems = [];
    for (let i = 0; i < videoList.length; i++) {
        const thumbnailPath = videoList[i].thumbnail;
        const doesFileExist = await doesFileExistAsync(thumbnailPath);
        if (!doesFileExist) {
            failedItems.push(videoList[i]);
        }
    }

    return Promise.resolve(failedItems);
};

const saveThumbnail = async (videoId, imgBase64Data) => {
    const buf = Buffer.from(imgBase64Data, 'base64');
    const directoryPath = getThumbnailsDir();

    return writeFile(path.join(directoryPath, `${videoId}.jpg`), buf);
};

const deleteGeneratedMediaFile = async ({ mediaId, directoryPath, extension, fileLabel }) => {
    const filePath = path.join(directoryPath, `${mediaId}.${extension}`);
    const fileExists = await doesFileExistAsync(filePath);

    if (!fileExists) {
        return;
    }

    try {
        await removeFile(filePath);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }

        console.warn(`Could not delete ${fileLabel} ${filePath}: ${err.message}`);
        return false;
    }
};

const deleteThumbnail = async (mediaId) => {
    return deleteGeneratedMediaFile({
        mediaId,
        directoryPath: getThumbnailsDir(),
        extension: 'jpg',
        fileLabel: 'thumbnail',
    });
};

const deletePreviewVideo = async (mediaId) => {
    return deleteGeneratedMediaFile({
        mediaId,
        directoryPath: getPreviewDir(),
        extension: 'mp4',
        fileLabel: 'preview video',
    });
};

/**
 * createThumbnailAndSave creates thumbnails and saves it. This is done at main thread. So saving thumbnails are part of the
 * individual child functions.
 * @param {*} mediaType
 * @param {*} mediaPath
 * @param {*} mediaId
 * @param {*} isExternal
 * @returns
 */

const createThumbnailAndSave = async (mediaType, mediaId, mediaPath, isExternal) => {
    if (mediaType === mediaTypes.IMAGE) {
        const finalImagePath = await generateImageThumbnail({
            imagePath: mediaPath,
            thumbnailFolder: getThumbnailsDir(),
            imageId: mediaId,
        });
        if (finalImagePath) {
            return finalImagePath;
        }
    } else if (mediaType === mediaTypes.VIDEO) {
        const finalThumbnailPath = await generateVideoThumbnail({
            videoPath: operationData?.fullPath,
            thumbnailFolder: getThumbnailsDir(),
            videoId: operationData.newMediaStats?.id,
        });

        if (finalThumbnailPath) return finalThumbnailPath;
    }
};

const onVideoDelete = ({ videoId }) => {
    deleteThumbnail(videoId);
    deletePreviewVideo(videoId);
};
const onImageDelete = ({ imageId }) => {
    deleteThumbnail(imageId);
};

const initThumbnailService = () => {
    serviceEventBus.subscribe(interServiceEvents.DELETE_VIDEO, onVideoDelete);
    serviceEventBus.subscribe(interServiceEvents.DELETE_IMAGE, onImageDelete);
};

module.exports = {
    initThumbnailService,
    getThumbnailIntegrityStatus,
    saveThumbnail,
    deleteThumbnail,
    createThumbnailAndSave,
};
