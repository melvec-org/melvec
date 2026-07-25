const mainThreadEvents = require('../../events/mainThreadEvents');
const { emitToUI } = require('../service-utils/sendToUI');
const { initThumbnailService, saveThumbnail, createThumbnailAndSave } = require('./thumbnail');

// this is a fallback service if ffmpeg does not work.
const saveThumbnailService = (eventData) => {
    saveThumbnail(eventData?.videoId, eventData?.imgBase64Data).then((data) => {
        if (data) {
            emitToUI(mainThreadEvents.ON_THUMBNAIL_UPDATE, { path: data });
        }
    });
};

const createThumbnailService = async (args) => {
    const { mediaId, mediaType, mediaPath, isExternal } = args;
    const thumbnailPath = await createThumbnailAndSave(mediaType, mediaId, mediaPath);
    if (thumbnailPath) {
        emitToUI(mainThreadEvents.ON_THUMBNAIL_UPDATE, { path: thumbnailPath });
    }
};

module.exports = {
    saveThumbnailService,
    createThumbnailService,
    initThumbnailService,
};
