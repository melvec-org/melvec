/**
 * These events are based on user interaction. This may further impact app context events.
 * These are mostly asynchronous
 */
const rendererEvents = {
    OPEN_ROOT_LIBRARY_SELECTOR: 'openRootLibrarySelector',
    SELECT_LIBRARY_PATH: 'selectLibraryPath', // apply a known path directly, no folder dialog
    OPEN_WATCH_FOLDER: 'openWatchFolder',
    OPEN_BACKUP_FOLDER: 'openBackupFolder',
    OPEN_EXPORT_FOLDER: 'openExportFolder',
    OPEN_DB_TO_IMPORT: 'openDBToImport',
    OPEN_METADATA_FILE_TO_IMPORT: 'openMetaDataFileToImport',
    OPEN_LOCAL_MODELS_FOLDER: 'openLocalModelDirectroy',

    // collections
    MEDIA_SWITCH_COLLECTION: 'moveMediaToCollection',
    IMPORT_MEDIA_TO_COLLECTION: 'importMediaToCollection',

    // tags
    IMPORT_TAGS: 'importTags',

    // playlists
    PLAYLIST_ADD_VIDEO: 'playlist.addVideo',
    ADD_NEW_PLAYLIST_TO_VIDEO: 'playlist.createNew.addVideo',

    ADD_MULTIPLE_VIDEOS_TO_PLAYLIST: 'addMultipleVideosToPlaylist', // This is to add multiple videos to a playlist.

    // thumbnail
    THUMBNAIL_CREATE: 'thumbnail.create',
    THUMBNAIL_SAVE: 'thumbnail:save',

    // search
    SEARCH_HISTORY_ADD: 'search.addToHistory',
    SEARCH_HISTORY_DELETE: 'search.deleteFromHistory',
};

module.exports = rendererEvents;
