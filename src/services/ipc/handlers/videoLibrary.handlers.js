const serviceMethods = require('../../../constants/serviceMethods');

const { getRelatedVideos } = require('../../related-videos/relatedVideos.service');

const {
    updateContentRatingService,
    updateContentQualityService,
    increaseVideoViewCount,
} = require('../../video-metrics/videoMetrics.service');

const {
    updateVideoSourceService,
    updateVideoCategoryService,
    getFullVideoDetailsById,
} = require('../../video-library/videoLibrary.service');

const videoLibraryServiceHandlers = [
    [serviceMethods.VIDEO_GET_RELATED, async (videoId) => getRelatedVideos(videoId)],
    [serviceMethods.VIDEO_INCREASE_VIEW_COUNT, async (videoId) => increaseVideoViewCount(videoId)],
    [serviceMethods.VIDEO_UPDATE_SOURCE, async (videoId, source) => updateVideoSourceService(videoId, source)],
    [serviceMethods.VIDEO_UPDATE_CATEGORY, async (videoId, categoryId) => updateVideoCategoryService(videoId, categoryId)],
    [serviceMethods.VIDEO_GET_FULL_DETAILS, async (videoId) => getFullVideoDetailsById(videoId)],
    [serviceMethods.VIDEO_UPDATE_CONTENT_RATING, async (videoId, rating) => updateContentRatingService(videoId, rating)],
    [serviceMethods.VIDEO_UPDATE_CONTENT_QUALITY, async (videoId, contentQuality) => updateContentQualityService(videoId, contentQuality)],
];

module.exports = {
    videoLibraryServiceHandlers,
};
