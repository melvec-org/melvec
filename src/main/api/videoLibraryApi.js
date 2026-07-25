const serviceMethods = require('../../constants/serviceMethods');
const videoLibraryApi = (ipcRenderer) => ({
    getFullVideoDetails: (videoId) => ipcRenderer.invoke(serviceMethods.VIDEO_GET_FULL_DETAILS, videoId),

    getRelatedVideos: (videoId) => ipcRenderer.invoke(serviceMethods.VIDEO_GET_RELATED, videoId),
    updateVideoSource: (videoId, source) => ipcRenderer.invoke(serviceMethods.VIDEO_UPDATE_SOURCE, videoId, source),

    updateContentQuality: (videoId, quality) => ipcRenderer.invoke(serviceMethods.VIDEO_UPDATE_CONTENT_QUALITY, videoId, quality),
    updateContentRating: (videoId, rating) => ipcRenderer.invoke(serviceMethods.VIDEO_UPDATE_CONTENT_RATING, videoId, rating),
    increaseVideoViewCount: (videoId) => ipcRenderer.invoke(serviceMethods.VIDEO_INCREASE_VIEW_COUNT, videoId),
    updateVideoCategory: (videoId, categoryId) => ipcRenderer.invoke(serviceMethods.VIDEO_UPDATE_CATEGORY, videoId, categoryId),
});
module.exports = { videoLibraryApi };
