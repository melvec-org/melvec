const { getMediaIdsByClusterId } = require('../../database/locationDbService');

const getMediaByLocations = (locations) => {
    const mediaList = new Set();

    for (let i = 0; i < locations.length; i++) {
        let location = locations[i];

        const mediaItems = getMediaIdsByClusterId(location.id);

        mediaList.add(...mediaItems);
    }
    return Array(...mediaList);
};

module.exports = {
    getMediaByLocations,
};
