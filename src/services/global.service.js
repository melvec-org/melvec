const { getLibDir } = require('./servicePathConfig');
const { clearAllActionHistory } = require('./history/actionHistory');
const { indexRelatedVideos } = require('./related-videos/relatedVideos');
const { clearLogs } = require('./logs/logService');
const { getAllCollectionNames } = require('./database/collectionsDbService');
const { getFolderSize } = require('./service-utils/fileUtils');
const { resetAllVideoMetaData, resetAllImageMetaData } = require('./database/database');
const { clearTagsDbCache, getTags } = require('./database/tagsDbService');
const { clearPlaylistDbCache, getPlaylists } = require('./database/playlistsDbService');
const { clearVideosDbCache, getAllVideoIds } = require('./database/videoLibraryDbService');
const { clearVideoMetricsDbCache } = require('./video-metrics/videoMetrics');
const { respondSuccess, emitToUI, respondError } = require('./service-utils/sendToUI');
const { forceUpdateSmartLists } = require('./smart-playlists/smartPlaylists.service');
const { resetApplicationSettings } = require('./application-settings/applicationSettings');
const userPreferenceStore = require('../main/userPreferenceStore');
const { clearImagesCache } = require('./database/imageLibraryDbService');

/**
 * Rebuilds derived/indexed application data.
 *
 * This triggers related-video indexing and refreshes smart playlists so that
 * search/discovery data stays in sync with the current library state.
 *
 * @async
 * @returns {Promise<Object>} Success response object.
 */
const reIndexAllDataService = async () => {
    try {
        await indexRelatedVideos();
        forceUpdateSmartLists();
        return respondSuccess('Re-indexing all data');
    } catch (error) {
        return respondError(`Failed to re-index all data: ${error.message}`);
    }
};

/**
 * Resets all stored video metadata and clears related in-memory caches.
 *
 * This clears cached tags, playlists, video metrics, videos, and action history
 * before resetting metadata in the database.
 *
 * @returns {{status: 'success'|'error', message: string}} Result object describing the outcome.
 */
const resetAllMetaDataService = () => {
    try {
        // clear all cache,
        clearTagsDbCache();
        clearPlaylistDbCache();
        clearVideoMetricsDbCache();
        clearVideosDbCache();
        clearImagesCache();
        clearAllActionHistory();

        // finally clear
        resetAllVideoMetaData();
        resetAllImageMetaData();

        return respondSuccess('All metadata reset successfully');
    } catch (error) {
        return respondError(`Failed to reset all metadata: ${error.message}`);
    }
};

/**
 * Builds a system-level report for the current library and runtime.
 *
 * Includes counts for videos, collections, tags, playlists, current heap usage,
 * and total library folder size.
 *
 * @async
 * @returns {Promise<{
 *   totalVideos: number,
 *   totalCollections: number,
 *   totalTags: number,
 *   totalPlaylists: number,
 *   totalMemoryUsage: string,
 *   librarySize: string|number
 * }>} Aggregated system report.
 */
const getSystemReportService = async () => {
    try {
        const librarySize = await getFolderSize(getLibDir());

        return respondSuccess('System report retrieved successfully', {
            totalVideos: getAllVideoIds().length,
            totalCollections: getAllCollectionNames().length,
            totalTags: getTags().length,
            totalPlaylists: getPlaylists().length,
            totalMemoryUsage: Number(process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2) + ' MB',
            librarySize: librarySize,
        });
    } catch (error) {
        return respondError(`Failed to get system report: ${error.message}`);
    }
};

/**
 * Resets application settings and user preferences back to defaults.
 *
 * @async
 * @returns {Promise<Object>} Success response object.
 */
const resetPreferencesAndSettings = async () => {
    try {
        resetApplicationSettings();

        userPreferenceStore.reset();
        return respondSuccess('Preferences and settings reset successfully');
    } catch (error) {
        return respondError(`Failed to reset preferences and settings: ${error.message}`);
    }
};

module.exports = {
    reIndexAllDataService,
    clearAllLogs: clearLogs,
    getSystemReportService,
    resetAllMetaDataService,

    resetPreferencesAndSettings,
};
