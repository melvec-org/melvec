const path = require('path');

const {
    getVideoDetailsById,

    initVideoLibraryService,
    deleteVideoDetails,
    renameVideoFile,
    getAllVideos,
    moveVideo,
    udpateVideoTitle,
    updateNsfwStatus,
    checkForDuplicate,
    updateVideoCategory,
} = require('./videoLibrary');
const { getHiddenCollectionIds } = require('../collections/collections');
const { getThumbnailsDir, getPreviewDir } = require('../servicePathConfig');
const { getVideoMetricsByVideoId } = require('../video-metrics/videoMetrics');
const { getPlaylistsByVideoId } = require('../playlists/playlists');
const { getTagsByVideoId } = require('../tags/tags');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');

const { respondSuccess, respondError, respondFailure } = require('../service-utils/sendToUI');
const { updateSource, deleteVideo } = require('../database/videoLibraryDbService');
const mediaTypes = require('../../constants/mediaTypes');
const indexingEvents = require('../../events/indexingEvents');
const responseStatus = require('../../constants/responseStatus');
const { getLocationNameByMediaId } = require('../location/location');

const _getBasicVideoDetailsById = (videoId) => {
    if (videoId === undefined) {
        throw new Error('Invalid videoId', videoId);
    }
    let videoDetails = getVideoDetailsById(videoId);

    const hiddenCollections = getHiddenCollectionIds();

    if (videoDetails !== null) {
        const finalVideoDetails = {
            thumbnailURL: path.join(getThumbnailsDir(), `${videoId}.jpg`),
            id: videoDetails.id,
            name: videoDetails.name,
            collection: videoDetails.coll,
            collectionId: videoDetails.collection_id,
            path: videoDetails.path,
            size: videoDetails.size,
            duration: videoDetails.duration,
            birthtimeMs: videoDetails.birthtimeMs,
            title: videoDetails.title,
            isHidden: hiddenCollections.has(videoDetails.collection_id),
            isNsfw: videoDetails.is_nsfw,
            source: videoDetails.source,
            categoryId: videoDetails.category_id || null,
            mediaType: mediaTypes.VIDEO,
        };
        if (videoDetails.has_preview) {
            finalVideoDetails.previewPath = path.join(getPreviewDir(), `${videoId}.mp4`);
        } else {
            finalVideoDetails.previewPath = null;
        }
        return finalVideoDetails;
    } else {
        // TODO : if null is comming apply for data reIndexing
        console.error('null data is persisting, clean call please', videoId);
    }
    return null;
};

const _getFullVideoDetailsById = (videoId) => {
    let videoDetails = _getBasicVideoDetailsById(videoId);

    const defaultMetaData = { views: 0, content_quality: 0, rating: 0 };
    const metaData = getVideoMetricsByVideoId(videoId) || defaultMetaData;

    if (videoDetails !== null) {
        videoDetails.views = metaData.views;
        videoDetails.quality = metaData.content_quality;
        videoDetails.rating = metaData.rating;
        videoDetails.playlists = getPlaylistsByVideoId(videoId);
        videoDetails.tags = getTagsByVideoId(videoId);
        videoDetails.locationName = getLocationNameByMediaId(mediaTypes.VIDEO, videoId);

        return videoDetails;
    }
    return null;
};

const removeVideoFromLibrary = async (videoId, initiator) => {
    // publish the event for delete video so that respective services can access video details before it's actually gone.
    serviceEventBus.publish(interServiceEvents.DELETE_VIDEO, { videoId: videoId });
    if (initiator !== 'ENOENT') {
        const isDeleteSuccess = await deleteVideoDetails(videoId);
        if (isDeleteSuccess) {
            serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
                change: indexingEvents.VIDEO_DELETE,
                videoId: videoId,
            });
            return {
                status: responseStatus.SUCCESS,
                videoId,
            };
        } else {
            return {
                status: 'error',
                message: 'Failed to delete video',
            };
        }
    } else {
        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
            change: indexingEvents.VIDEO_DELETE,
            videoId: videoId,
        });
        const isDeleteSuccess = deleteVideo(videoId);
        if (isDeleteSuccess) {
            return {
                status: responseStatus.SUCCESS,
                videoId,
            };
        }
    }
};

const removeVideoFromLibraryService = async (videoId, initiator) => {
    try {
        await removeVideoFromLibrary(videoId, initiator);
        return respondSuccess('Video removed successfully');
    } catch (error) {
        return respondError(`system error while removing. ${error.message}`);
    }
};

const updateVideoTitleService = (videoId, title) => {
    try {
        const updatedVideoDetails = udpateVideoTitle(videoId, title);

        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
            change: indexingEvents.VIDEO_TITLE_CHANGE,
            videoId: videoId,
        });
        return respondSuccess('Title updated successfully', updatedVideoDetails);
    } catch (error) {
        return respondError(`system error while updating. ${error.message}`);
    }
};

const updateNsfwStatusService = (videoId, isNsfw) => {
    try {
        const updatedVideoDetails = updateNsfwStatus(videoId, isNsfw);

        return respondSuccess('NSFW status updated successfully', updatedVideoDetails);
    } catch (error) {
        return respondError(`system error while updating. ${error.message}`);
    }
};

const updateVideoSourceService = (videoId, source) => {
    try {
        const result = updateSource(videoId, source);

        if (result) {
            return respondSuccess(`Updated source for video ${videoId} to ${source}`);
        } else {
            return respondFailure('failure', `Failed to update source for video ${videoId}. Please check your connection.`);
        }
    } catch (error) {
        return respondError(`system error while updating. ${error.message}`);
    }
};

const updateVideoCategoryService = (videoId, categoryId) => {
    try {
        const result = updateVideoCategory(videoId, categoryId);

        if (result) {
            serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
                change: indexingEvents.VIDEO_CATEGORY_CHANGE,
                videoId: videoId,
            });
            return respondSuccess(`Updated category for video ${videoId}`, {
                videoId,
                categoryId,
            });
        } else {
            return respondFailure(`Failed to update category for video ${videoId}.`);
        }
    } catch (error) {
        return respondError(`system error while updating. ${error.message}`);
    }
};

module.exports = {
    initVideoLibraryService,
    getFullVideoDetailsById: _getFullVideoDetailsById,
    getBasicVideoDetailsById: _getBasicVideoDetailsById,
    removeVideoFromLibrary,
    removeVideoFromLibraryService,
    updateVideoTitleService,
    updateNsfwStatusService,
    renameVideoFile,
    getAllVideos,
    moveVideo,
    checkForDuplicate,
    updateVideoSourceService,
    updateVideoCategoryService,
};
