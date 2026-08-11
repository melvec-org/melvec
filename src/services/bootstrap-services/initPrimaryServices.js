const { initLibraryLogService } = require('../logs/logService');
const { initApplicationSettings } = require('../application-settings/applicationSettings');
const { initializeDatabase } = require('../database/database');
const { initVideoMetricsService } = require('../video-metrics/videoMetrics.service');
const { initTagService } = require('../tags/tags.service');
const { initVideoCategoriesService } = require('../video-categories/videoCategories.service');
const { initImageLibraryService } = require('../image-library/imageLibrary.service');
const { initAudioLibraryService } = require('../audio-library/audioLibrary.service');
const { initVideoLibraryService } = require('../video-library/videoLibrary.service');
const { initCollectionsService } = require('../collections/collections.service');
const { initWatchFolderService } = require('../watch-folders/watchFolders.service');
const { initLocationService } = require('../location/location.service');

const initPrimaryServices = () => {
    initLibraryLogService();
    initApplicationSettings();
    initializeDatabase();
    initLocationService();
    initVideoMetricsService();
    initTagService();
    initVideoCategoriesService();
    initImageLibraryService();
    initAudioLibraryService();
    initVideoLibraryService();
    initCollectionsService();
    initWatchFolderService();
};
module.exports = {
    initPrimaryServices,
};
