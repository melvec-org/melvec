const { initActionHistoryService } = require('../history/actionHistory.service');
const { initSmartPlaylistsService } = require('../smart-playlists/smartPlaylists.service');
const { initPlaylistsService } = require('../playlists/playlist.service');
const { initThumbnailService } = require('../thumbnail/thumbnail.service');
const { initSearchService } = require('../search/search.service');
const { forceUpdateSmartLists } = require('../smart-playlists/smartPlaylists.service');
const { initRelatedVideosService } = require('../related-videos/relatedVideos.service');
const { initVideoMetaDataService } = require('../video-metadata/videoMetaData.service');

const initSecondaryServices = () => {
    initActionHistoryService();
    initSmartPlaylistsService();
    initPlaylistsService();
    initThumbnailService();
    initSearchService();
    forceUpdateSmartLists();
    initRelatedVideosService();
    initVideoMetaDataService();
};

module.exports = {
    initSecondaryServices,
};
