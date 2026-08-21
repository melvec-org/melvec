const { getBasicImageDetailsById } = require('../../image-library/imageLibrary');
const { getBasicAudioDetailsById } = require('../../audio-library/audioLibrary');
const { getBasicVideoDetailsById } = require('../../video-library/videoLibrary.service');
const mediaTypes = require('../../../constants/mediaTypes');

const populateMediaDetails = (mediaList) => {
    return mediaList.map((item, index) => {
        let fleshedItem = null;
        if (item.mediaType === mediaTypes.VIDEO) {
            fleshedItem = getBasicVideoDetailsById(item.id);
        } else if (item.mediaType === mediaTypes.IMAGE) {
            fleshedItem = getBasicImageDetailsById(item.id);
        } else if (item.mediaType === mediaTypes.AUDIO) {
            fleshedItem = getBasicAudioDetailsById(item.id);
        }

        if (fleshedItem) {
            fleshedItem['relevance'] = index;
        }

        return fleshedItem;
    });
};

module.exports = {
    populateMediaDetails,
};
