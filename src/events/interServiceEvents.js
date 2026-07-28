/**
 * These events are used inside the services only. Not to be exposed to UI/main layer
 * @type {{VIDEO_IMPORT_PROGRESS: string}}
 */
const interServiceEvents = {
    DATABASE_INITIALIZED: 'interServiceEvents/databaseInitialized',
    VIDEO_IMPORT_PROGRESS: 'interServiceEvents/videoImportProgress',
    DELETE_VIDEO: 'interServiceEvents/deleteVideo',
    DELETE_IMAGE: 'interServiceEvents/deleteImage',
    DELETE_AUDIO: 'interServiceEvents/deleteImage',
    REFRESH_VIDEO_LIBRARY: 'interServiceEvents/refresh_video_library',
    IMPORT_FILE_SUCCESS: 'interServiceEvents/importFileSuccess',
    VIDEO_COLLECTION_CHANGE: 'interServiceEvents/videoCollectionChange',

    // failure events
    IMPORT_VIDEO_FAILURE: 'interServiceEvents/importVideoFailure',

    // before app quits
    CLOSE_APP_REQUEST: 'interServiceEvents/closeAppRequest',
    BEFORE_APP_QUIT: 'interServiceEvents/beforeAppQuit',

    // when the system has added, updated, removed any video, tags, playlists, meta attributes like title, collection renamed
    INDEX_DATA_CHANGED: 'interServiceEvents/indexDataChanged',
};

module.exports = interServiceEvents;
