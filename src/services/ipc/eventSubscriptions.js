const rendererEvents = require('../../events/rendererEvents');
const { importTagsService } = require('../tags/tags.service');
const {
    addVideoToPlaylistService,
    addNewPlaylistToVideoService,
    addMultipleVideosToPlaylistService,
} = require('../playlists/playlist.service');
const { addToSearchHistoryService, deleteSearchHistoryItemService } = require('../search/search.service');
const { importMediaToCollectionService } = require('../watch-folders/watchFolders.service');
const { changeMediaCollection } = require('../commonMediaService');
const { saveThumbnailService, createThumbnailService } = require('../thumbnail/thumbnail.service');

const serviceEventMap = {};

// tag services

serviceEventMap[rendererEvents.IMPORT_TAGS] = importTagsService;

// Playlist services
serviceEventMap[rendererEvents.PLAYLIST_ADD_VIDEO] = addVideoToPlaylistService;
serviceEventMap[rendererEvents.ADD_NEW_PLAYLIST_TO_VIDEO] = addNewPlaylistToVideoService;
serviceEventMap[rendererEvents.ADD_MULTIPLE_VIDEOS_TO_PLAYLIST] = addMultipleVideosToPlaylistService;

// thumbnail services
serviceEventMap[rendererEvents.THUMBNAIL_CREATE] = createThumbnailService;
serviceEventMap[rendererEvents.THUMBNAIL_SAVE] = saveThumbnailService;

// collection services
serviceEventMap[rendererEvents.MEDIA_SWITCH_COLLECTION] = changeMediaCollection;

// watchfolder services
serviceEventMap[rendererEvents.IMPORT_MEDIA_TO_COLLECTION] = importMediaToCollectionService;

// search services
serviceEventMap[rendererEvents.SEARCH_HISTORY_ADD] = addToSearchHistoryService;
serviceEventMap[rendererEvents.SEARCH_HISTORY_DELETE] = deleteSearchHistoryItemService;

const handleRenderEventSubscription = (event, arg) => {
    if (serviceEventMap[arg.event]) {
        serviceEventMap[arg.event](arg);
    } else {
        console.error('serviceGateway: ', arg.event, 'is not handled by any service');
    }
};

module.exports = {
    handleRenderEventSubscription,
};
