/**
 * All service calls made from browser to main process.
 * Note:
 * Naming convention followed here is:
 * [MODULE]_[ACTION]_[TARGET]
 * */

const serviceMethods = {
    // ======== COLLECTIONS
    COLLECTION_HIDE: 'hideCollection',
    COLLECTION_UNHIDE: 'unhideCollection',
    COLLECTION_REMOVE: 'removeCollection',
    COLLECTION_RENAME: 'renameCollection',
    COLLECTION_ADD_NEW: 'addNewCollection',
    COLLECTION_GET_DETAILS: 'getCollectionDetails',

    // ======== WATCHFOLDERS
    WATCHFOLDER_GET_LIST: 'getWatchFolders',
    WATCHFOLDER_ADD: 'addWatchFolder',
    WATCHFOLDER_REMOVE: 'removeWatchFolder',
    WATCHFOLDER_REFRESH: 'refreshWatchFolder',
    WATCHFOLDER_REMOVE_MEDIA: 'removeMediaFromWatchFolder',
    WATCHFOLDER_BULK_IMPORT_TO_COLLECTION: 'bulkImportToCollection',
    WATCHFOLDER_STOP_BULK_IMPORT: 'stopBulkImportToCollection',

    // ========= PLAYLISTS
    PLAYLIST_ADD_NEW: 'addNewPlaylist',
    PLAYLIST_REMOVE: 'removePlaylist',
    PLAYLIST_GET_MOST_USED: 'getMostUsedPlaylists',
    PLAYLIST_GET_LAST_USED: 'getLastUsedPlaylists',
    PLAYLIST_RENAME: 'renamePlaylist',
    PLAYLIST_GET_DETAILS: 'getPlaylistDetails',
    PLAYLIST_REMOVE_VIDEO: 'removeVideoFromPlaylist',
    PLAYLIST_REORDER_VIDEOS: 'reorderVideosInPlaylist',

    // ======== SMART PLAYLISTS =========
    SMART_PLAYLIST_GET_NEWLY_ADDED: 'getNewlyAddedVideosSmartList',
    SMART_PLAYLIST_GET_MOST_PLAYED: 'getMostPlayedVideosSmartList',
    SMART_PLAYLIST_GET_LEAST_PLAYED: 'getLeastPlayedVideosSmartList',
    SMART_PLAYLIST_GET_MOST_SEARCHED: 'getMostSearchedVideosSmartList',
    SMART_PLAYLIST_GET_RECENTLY_PLAYED: 'getRecentlyPlayedVideosSmartList',
    SMART_PLAYLIST_GET_TOP_RATED: 'getTopRatedVideosSmartList',
    SMART_PLAYLIST_GET_ECHOES: 'getEchoesSmartList',

    // ======== TAGS. =========
    TAGS_GET_ALL: 'getTags',
    TAGS_ADD_NEW: 'addNewTag',
    TAGS_REMOVE: 'removeTag',
    TAGS_RENAME: 'renameTag',
    TAGS_GET_LAST_USED_LIST: 'getLastUsedTagsList',
    TAGS_GET_MOST_USED_LIST: 'getMostUsedTagsList',
    TAGS_GET_TOP_TAG_PLAYLIST_DETAILS: 'getTopTagPlaylistDetails',
    TAGS_ADD_MEDIA_TO_TAG: 'addMediaToTag',
    TAGS_ADD_MEDIA_TO_NEW_TAG: 'addMediaToNewTag',
    TAGS_REMOVE_MEDIA_FROM_TAG: 'removeMediaFromTag',

    // ========= VIDEOS  =======
    VIDEO_GET_RELATED: 'getRelatedVideos',

    VIDEO_UPDATE_SOURCE: 'updateVideoSource',
    VIDEO_UPDATE_CATEGORY: 'updateVideoCategory',
    VIDEO_GET_FULL_DETAILS: 'getFullVideoDetailsById',

    // ========== COMMON ( VIDEOS AND IMAGES) =========
    MEDIA_UPDATE_TITLE: 'updateMediaTitle',
    MEDIA_UPDATE_NSFW_STATUS: 'updateMediaNsfwStatus',
    MEDIA_RENAME_FILE: 'renameMediaFile',
    MEDIA_BULK_REMOVE: 'bulkRemoveMedia',
    MEDIA_BULK_UPDATE_NSFW_STATUS: 'bulkMediaNsfwStatus',
    MEDIA_BULK_UPDATE_CATEGORY: 'bulkMediaCategory',
    MEDIA_BULK_UPDATE_COLLECTION: 'changeBulkMediaCollection',
    MEDIA_BULK_IMPORT_TO_COLLECTION: 'importBulkMediaToCollection',
    MEDIA_BULK_RESET_METADATA: 'resetBulkMediaMetadata',
    MEDIA_REMOVE_FROM_LIBRARY: 'removeMediaFromLibrary',

    // ========= VIDEO METRICS =========

    VIDEO_UPDATE_CONTENT_QUALITY: 'updateContentQuality',
    VIDEO_INCREASE_VIEW_COUNT: 'increaseVideoViewCount',
    VIDEO_UPDATE_CONTENT_RATING: 'updateContentRating',

    // ========= VIDEO METADATA =========
    VIDEO_META_DATA_GET_DETAILS: 'getVideoMetaDataDetails',
    VIDEO_META_DATA_SET_DESCRIPTION: 'setVideoMetaDescription',
    VIDEO_META_DATA_GENERATE_DESCRIPTION: 'generateVideoDescription',
    VIDEO_META_DATA_GET_SHORT_DESCRIPTION: 'getShortVideoDescription',
    VIDEO_META_DATA_GENERATE_TRANSCRIPT: 'generateTranscript',
    VIDEO_META_DATA_STOP_GENERATING_DESCRIPTION: 'stopGeneratingDescription',
    VIDEO_META_DATA_START_BATCH_DESCRIPTION_GENERATION: 'startBatchDescriptionGeneration',
    VIDEO_META_DATA_STOP_BATCH_DESCRIPTION_GENERATION: 'stopBatchDescriptionGeneration',

    // ========= IMAGES  =======
    IMAGE_GET_FULL_DETAILS: 'getFullImageDetails',

    // ========== IMAGE METADATA =========
    IMAGE_META_DATA_SET_DESCRIPTION: 'setImageMetaDescription',
    IMAGE_META_DATA_GET_DETAILS: 'getImageMetaDataDetails',
    IMAGE_META_DATA_GENERATE_DESCRIPTION: 'generateImageDescription',
    IMAGE_META_DATA_STOP_GENERATING_DESCRIPTION: 'stopGeneratingImageDescription',
    IMAGE_META_DATA_START_BATCH_GENERATION: 'startBatchImageMetaDataGeneration',
    IMAGE_META_DATA_STOP_BATCH_GENERATION: 'stopBatchImageMetaDataGeneration',

    // ========= AUDIOS  =======
    AUDIO_GET_FULL_DETAILS: 'getFullAudioDetails',

    // ========== AUDIO METADATA =========
    AUDIO_META_DATA_SET_DESCRIPTION: 'setAudioMetaDescription',
    AUDIO_META_DATA_GET_DETAILS: 'getAudioMetaDataDetails',
    AUDIO_META_DATA_GENERATE_DESCRIPTION: 'generateAudioDescription',
    AUDIO_META_DATA_STOP_GENERATING_DESCRIPTION: 'stopGeneratingAudioDescription',
    AUDIO_META_DATA_START_BATCH_GENERATION: 'startBatchAudioMetaDataGeneration',
    AUDIO_META_DATA_STOP_BATCH_GENERATION: 'stopBatchAudioMetaDataGeneration',

    // ========== VIDEO PREVIEW =========
    VIDEO_PREVIEW_START_BATCH_GENERATION: 'startBatchVideoPreviewGeneration',
    VIDEO_PREVIEW_STOP_BATCH_GENERATION: 'stopBatchVideoPreviewGeneration',
    VIDEO_PREVIEW_GET_PENDING_COUNT: 'getPendingVideoPreviewCount',
    VIDEO_PREVIEW_CLEAR_ALL: 'clearAllVideoPreviews',

    // ========= SEARCH ========
    SEARCH_GET_RESULTS: 'getSearchResults',
    SEARCH_GET_HISTORY: 'getSearchHistory',
    SEARCH_GET_INDEXED_HISTORY: 'getIndexedSearchHistory',
    SEARCH_REINDEX_ALL_DATA: 'reIndexAllData',
    SEARCH_CLEAR_HISTORY: 'clearSearchHistory',

    // ========== IMPORT / EXPORT ======
    EXPORT_VIDEOS_START: 'startExportingVideos',
    EXPORT_VIDEOS_PAUSE: 'pauseExportingVideos',
    EXPORT_VIDEOS_RESUME: 'resumeExportingVideos',
    EXPORT_VIDEOS_STOP: 'stopExportingVideos',
    IMPORT_META_DATA: 'importAllMetaData',
    EXPORT_META_DATA: 'exportAllMetaData',
    EXPORT_DATABASE: 'startDatabaseBackup',
    IMPORT_DATABASE: 'importDatabase',

    // ========== GENERAL SYSTEMS
    SYSTEM_GET_LOGS: 'getLogs',
    SYSTEM_CLEAR_LOGS: 'clearAllLogs',
    SYSTEM_GET_REPORT: 'getSystemReport',
    SYSTEM_RESET_META_DATA: 'resetAllMetaData',
    SYSTEM_CLEAR_ACTION_HISTORY: 'clearAllActionHistory',

    // ========= user and application settings under SYSTEM
    SYSTEM_GET_USER_PREF: 'getUserPreference',
    SYSTEM_SET_USER_PREF: 'setUserPreference',
    SYSTEM_GET_ALL_USER_PREF: 'getAllUserPreferences',
    SYSTEM_GET_APP_SETTINGS: 'getApplicationSettings',
    SYSTEM_SET_APP_SETTINGS: 'setApplicationSettings',
    SYSTEM_RESET_PREFERENCES_AND_SETTINGS: 'resetPreferencesAndSettings',
    SYSTEM_APPLY_THEME: 'applyTheme',

    //============ EXTRAS: TRANSCODING ===========
    TRANSCODING_START_OPTIMIZING_VIDEO: 'startOptimizingVideo',
    TRANSCODING_STOP_OPTIMIZING_VIDEO: 'stopOptimizingVideo',

    TRANSCODING_START_RESIZING_VIDEO: 'startResizingVideo',
    TRANSCODING_STOP_RESIZING_VIDEO: 'stopResizingVideo',

    TRANSCODING_START_VIDEO_FORMAT_CONVERSION: 'startVideoFormatConversion',
    TRANSCODING_STOP_VIDEO_FORMAT_CONVERSION: 'stopVideoFormatConversion',

    // =========== AI MODELS ==============
    AI_MODELS_DOWNLOAD: 'downloadAIModels',
    AI_MODELS_CANCEL_DOWNLOAD: 'cancelDownloadAIModels',
    AI_MODELS_PAUSE_DOWNLOAD: 'pauseDownloadModels',
    AI_MODELS_RESUME_DOWNLOAD: 'resumeDownloadModels',
    AI_MODELS_CHECK_FOR_MODEL_FILES: 'checkForModelFiles',
    AI_MODELS_DELETE_MODEL_FILES: 'deleteModelFiles',
    AI_MODELS_LOCAL_IMPORT: 'importAIModelsFromLocal',

    //============ OTHER SERVICES ===========
    BROWSE_VIDEO_FILE_FROM_SYSTEM: 'browseVideoFileFromSystem',
};

module.exports = serviceMethods;
