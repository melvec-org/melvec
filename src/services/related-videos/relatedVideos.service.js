const { getRelatedVideosById, initRelatedVideosService, indexRelatedVideos } = require('./relatedVideos');
const { getBasicVideoDetailsById } = require('../video-library/videoLibrary.service');
const getRelatedVideos = (videoId) => {
    if (videoId) {
        const relatedVideoIds = getRelatedVideosById(videoId);

        return relatedVideoIds.map((videoId) => getBasicVideoDetailsById(videoId));
    } else {
        return [];
    }
};

module.exports = {
    getRelatedVideos,
    initRelatedVideosService,
    indexRelatedVideos,
};
