const systemConfig = require('../../configs/systemConfig');
const mediaTypes = require('../../constants/mediaTypes');

const getMediaTypeFromPath = (filePath = '') => {
    if (systemConfig.SUPPORTED_VIDEO_EXTENSIONS.test(filePath)) {
        return mediaTypes.VIDEO;
    }

    if (systemConfig.SUPPORTED_IMAGE_EXTENSIONS.test(filePath)) {
        return mediaTypes.IMAGE;
    }

    if (systemConfig.SUPPORTED_AUDIO_EXTENSIONS.test(filePath)) {
        return mediaTypes.AUDIO;
    }

    return mediaTypes.UNKNOWN;
};

module.exports = getMediaTypeFromPath;
