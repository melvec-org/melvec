// these events are specific to front end react context. Not to be used anywhere else
const applicationEvents = {
    APP_STATUS_UPDATE: 'appStatusUpdate',
    USER_PREFERENCE_UPDATE: 'applicationEvents/userPreferenceUpdate',
    PLAY_VIDEO: 'playVideo',
    CHANGE_APPLICATION_VIEW: 'changeApplicationView',
    PLAY_VIDEO_FROM_PLAYLIST: 'playVideoFromPlaylist',
    GOTO_COLLECTION: 'gotoCollection',
    GOTO_PLAYLIST: 'gotoPlaylist',
    COLLECTIONS_UPDATE: 'appEvents/onCollectionsUpdate',
    WATCH_FOLDERS_UPDATE: 'appEvents/onWatchFoldersUpdate',
    TAGS_UPDATE: 'appEvents/onTagsUpdate',
    TOGGLE_HIDDEN_COLLECTIONS: 'appEvents/toggleHiddenCollections',
};
module.exports = applicationEvents;
