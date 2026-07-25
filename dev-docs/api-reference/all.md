### 1. Theme / Appearance

- `applyTheme(theme)`

### 2. Collections

- `addNewCollection(year, label, isHidden)`
- `removeCollection(collectionId)`
- `renameCollection(collectionId, newLabel)`
- `hideCollection(collectionId)`
- `unhideCollection(collectionId)`
- `getCollectionDetails(collectionId, isExternalCollection)`

### 3. Watch Folders

- `getWatchFolders()`
- `addWatchFolder(watchFolder)`
- `removeWatchFolder(watchFolderId)`
- `refreshWatchFolder(watchFolderId)`

### 4. Tags

- `addNewTag(tag)`
- `removeTag(tagId)`
- `renameTag(tagId, newLabel)`
- `getLastUsedTagsList()`
- `getMostUsedTagsList()`
- `getTopTagPlaylistDetails(tagId)`
- `addMediaToTag(mediaType, mediaId, tagId)`
- `removeMediaFromTag(mediaType, mediaId, tagId)`
- `addMediaToNewTag(mediaType, mediaId, tagId, tagLabel)`

### 5. Playlists

- `addNewPlaylist(playlist)`
- `removePlaylist(playlistId)`
- `renamePlaylist(playlistId, newLabel)`
- `reorderVideosInPlaylist(playlist, videoId, newPos)`
- `removeVideoFromPlaylist(playlistId, videoId)`
- `getPlaylistDetails(playlistId)`
- `getLastUsedPlaylists()`
- `getMostUsedPlaylists()`

### 6. Smart Playlists

- `getNewlyAddedVideosSmartList()`
- `getMostPlayedVideosSmartList()`
- `getLeastPlayedVideosSmartList()`
- `getMostSearchedVideosSmartList()`
- `getRecentlyPlayedVideosSmartList()`
- `getTopRatedVideosSmartList()`
- `getEchoesSmartList()`

### 7. Videos

- `getRelatedVideos(videoId)`
- `updateVideoSource(videoId, source)`
- `updateVideoCategory(videoId, categoryId)`
- `renameMediaFile(mediaType, mediaId, oldFileName, newFileName)`
- `updateMediaTitle(mediaType, videoId, title)`
- `updateMediaNsfwStatus(mediaType, videoId, isNsfw)`
- `getFullVideoDetails(videoId)`

### 7A. Images

- `getFullImageDetails(imageId)`

### 8. Video Metrics

- `updateContentQuality(videoId, quality)`
- `updateContentRating(videoId, rating)`
- `increaseVideoViewCount(videoId)`

### 9. Video Metadata

- `getVideoMetaDataDetails(videoId)`
- `generateVideoDescription(videoId, shouldGenerateTitle)`
- `stopGeneratingVideoDescription(videoId)`
- `setVideoDescription(videoId, desc)`
- `getShortDescription(videoId)`
- `generateTranscript(videoId)`
- `startBatchVideoMetaDataGeneration(videoIds)`
- `stopBatchVideoMetaDataGeneration(videoIds)`

### 9A. Image Metadata

- `startImageMetaDataBatchGeneration()`
- `stopImageMetaDataBatchGeneration()`

### 10. Search

- `getSearchResults(searchText, isQuickSearch, filters)`
- `getSearchHistory(limit)`
- `getIndexedSearchHistory()`
- `clearSearchHistory()`
- `reIndexAllData()`

### 11. System / Maintenance

- `clearAllLogs()`
- `getSystemReport()`
- `getLogs()`
- `resetAllMetaData()`
- `clearAllActionHistory()`

### 12. Export / Backup

- `startExportingVideos(config)`
- `stopExportingVideos(trackingId)`
- `pauseExportingVideos(trackingId)`
- `resumeExportingVideos(trackingId)`
- `exportAllMetaData(config)`

### 13. User Preferences

- `getUserPreference(key)`
- `setUserPreference(key, value)`
- `getAllUserPreferences()`

### 14. Application Settings

- `getApplicationSettings(key)`
- `setApplicationSettings(key, value)`
- `resetPreferencesAndSetttings()`

### 15. Transcoding / Video Utilities

- `startOptimizingVideo(config)`
- `stopOptimizingVideo(processId)`
- `startResizingVideo(config)`
- `stopResizingVideo(processId)`
- `startVideoFormatConversion(config)`
- `stopVideoFormatConversion(processId)`

### 16. AI Model Services

- `downloadAIModels(modelTier)`
- `cancelDownloadAIModels(modelTier)`
- `pauseDownloadAIModels(modelTier)`
- `resumeDownloadAIModels(modelTier)`
- `checkForAIModelFiles(modelTier)`
- `deleteAIModelFiles(modelTier)`

### 17. File/System Helpers

- `chooseVideoFileFromSystem(operation)`

### 18. Event-based Messaging APIs

These are lower-level bridge APIs used for long-running tasks, UI event wiring, and streaming updates.

#### Send events to main process

- `send(channel, data)`

Allowed channels:

- `ipcChannels.NOTIFY_MAIN_PROCESS`
- `ipcChannels.CONTEXT_MENU_REQUEST`
- `ipcChannels.DOWNLOAD_FILE`
- `ipcChannels.IMPORT_FILE_REQUEST`
- `ipcChannels.OPEN_FOLDERS_REQUEST`
- `ipcChannels.OPEN_HELP_WINDOW`

#### Listen for recurring events from main process

- `receive(channel, func)`

Allowed channels:

- `ipcChannels.NOTIFY_RENDERER_PROCESS`
- `ipcChannels.IMPORT_FILE_ACTION`
- `ipcChannels.OPEN_FOLDERS_ACTION`
- `ipcChannels.CONTEXT_MENU_ACTION`
- `ipcChannels.APPLICATION_MENU_ACTION`
- `ipcChannels.ZOOM_FACTOR_CHANGE_ACTION`
- `ipcChannels.EVENT_STREAM`
- `ipcChannels.THEME_CHANGE_ACTION`

#### Listen once for single-use events

- `receiveOnce(channel, func)`

Allowed channels:

- `ipcChannels.CONTEXT_MENU_ACTION`
- `ipcChannels.IMPORTED_FROM_WATCH_FOLDER_ACTION`

#### Remove event listeners

- `stop(channel, func)`

Allowed channels:

- `ipcChannels.NOTIFY_RENDERER_PROCESS`
- `ipcChannels.IMPORT_FILE_ACTION`
- `ipcChannels.OPEN_FOLDERS_ACTION`
- `ipcChannels.CONTEXT_MENU_ACTION`
- `ipcChannels.APPLICATION_MENU_ACTION`
- `ipcChannels.ZOOM_FACTOR_CHANGE_ACTION`
- `ipcChannels.EVENT_STREAM`
- `ipcChannels.THEME_CHANGE_ACTION`

**Services List**
