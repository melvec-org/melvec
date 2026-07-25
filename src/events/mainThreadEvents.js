/**
 * These events happen when there is a change in main thread and UI need to be updated
 */
const mainThreadEvents = {
    ON_LIBRARY_PATH_NOT_FOUND: 'mainThreadEvents/onLibraryPathNotFound',
    ON_SUCCESSFUL_INIT: 'mainThreadEvents/onSuccessfulInit',
    ON_PLAYLIST_UPDATE: 'mainThreadEvents/onPlaylistUpdate',
    ON_VIDEO_DETAILS_UPDATE: 'mainThreadEvents/onVideoDetailsUpdate',
    ON_TAGS_UPDATE: 'mainThreadEvents/onTagsUpdate',
    ON_WATCH_FOLDER_SELECTED: 'mainThreadEvents/onWatchFolderSelection',
    ON_BACKUP_FOLDER_SELECTED: 'mainThreadEvents/onBackupFolderSelection',
    ON_METADATA_IMPORT_FOLDER_SELECTED: 'mainThreadEvents/onMetaDataImportFolderSelection',

    ON_IMPORT_PROGRESS: 'mainThreadEvents/onImportProgress',
    ON_IMPORT_FAILURE: 'mainThreadEvents/onImportFailure',
    ON_NEW_LIBRARY_SELECTION_COMPLETE: 'mainThreadEvents/newLibrarySelectionComplete',

    // video export services
    ON_EXPORT_FOLDER_SELECTED: 'mainThreadEvents/onExportFolderSelection',
    VIDEO_EXPORT_STARTED: 'mainThreadEvents/videoExportingStarted',
    VIDEO_EXPORT_PROGRESS: 'mainThreadEvents/videoExportingProgress',

    ON_DB_IMPORT_FILE_SELECTED: 'mainThreadEvents/onDbImportFileSelected',
    ON_DATABASE_BACKUP_COMPLETE: 'mainThreadEvents/onDatabaseBackupComplete',
    ON_DATABASE_IMPORT_COMPLETE: 'mainThreadEvents/onDatabaseImportComplete',

    ON_THUMBNAIL_UPDATE: 'mainThreadEvents/onThumbnailUpdate',

    ON_AI_MODEL_DOWNLOAD: 'mainThreadEvents/onAIModelsDownload',
    ON_AI_LOCAL_IMPORT_DIR_SELECT: 'mainThreadEvents/onAILocalModelDirSelect',
    ON_BATCH_DESCRIPTION_PROCESS: 'mainThreadEvents/onBatchDescriptionProcess',
    ON_BATCH_PREVIEW_PROCESS: 'mainThreadEvents/onBatchPreviewProcess',
    ON_BULK_IMPORT_TO_COLLECTION_PROCESS: 'mainThreadEvents/onBulkImportToCollectionProcess',

    ON_VIDEO_DESCRIPTION_GENERATED: 'mainThreadEvents/onVideoDescriptionGenerated',
    ON_IMAGE_DESCRIPTION_GENERATED: 'mainThreadEvents/onImageDescriptionGenerated',
    ON_AUDIO_DESCRIPTION_GENERATED: 'mainThreadEvents/onAudioDescriptionGenerated',
};

module.exports = mainThreadEvents;
