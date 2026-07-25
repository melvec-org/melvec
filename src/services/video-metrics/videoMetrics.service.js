const {
    increaseViewsByOne,
    initVideoMetricsService,
    updateContentQuality,
    updateContentRating,
    clearVideoMetricsDbCache,
    getMostViewedVideos,
    getTopRatedVideosList,
    updateSource,
} = require('./videoMetrics');
const { addVideoToWatchHistory } = require('../history/actionHistory');
const { respondSuccess, respondFailure, respondError } = require('../service-utils/sendToUI');

const increaseVideoViewCount = (videoId) => {
    addVideoToWatchHistory(videoId);
    increaseViewsByOne(videoId);
};

const updateContentRatingService = async (videoId, rating) => {
    try {
        const status = updateContentRating(videoId, rating);

        if (status) {
            return respondSuccess(`Rating updated successfully for ${videoId}`);
        } else {
            return respondFailure(`Rating cound not be udpated for ${videoId}`);
        }
    } catch (e) {
        return respondError(e);
    }
};

module.exports = {
    increaseVideoViewCount,

    initVideoMetricsService,
    updateContentQualityService: updateContentQuality,
    updateContentRating,
    clearVideoMetricsDbCache,
    updateContentRatingService,
    getMostViewedVideos,
    getTopRatedVideosList,
};
