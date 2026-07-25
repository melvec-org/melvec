/**
 * this file takes care of all the communication from renderer thread.
 */
const { ipcMain } = require('electron');
const servicePathConfig = require('./servicePathConfig');
const serviceEventBus = require('./service-utils/serviceEventBus');
const ipcChannels = require('../constants/ipcChannels');
const userPreferenceStore = require('../main/userPreferenceStore');
const { getTags } = require('./tags/tags.service');
const { getPlaylists } = require('./playlists/playlists');
const { getCollectionsList } = require('./collections/collections');
const { getWatchFolders } = require('./watch-folders/watchFolders.service');
const { getAllVideoCategories } = require('./video-categories/videoCategories.service');
const { initPrimaryServices } = require('./bootstrap-services/initPrimaryServices');
const { initSecondaryServices } = require('./bootstrap-services/initSecondaryServices');
const { registerHandlers } = require('./ipc/registerHandlers');
const { handleRenderEventSubscription } = require('./ipc/eventSubscriptions');

let serviceConfig = {};

const init = (config) => {
    serviceConfig = config;

    servicePathConfig.setLibraryRootPath(serviceConfig.libraryRootPath);
    serviceEventBus.removeAllListeners();
    initPrimaryServices();
    registerHandlers();

    ipcMain.off(ipcChannels.NOTIFY_MAIN_PROCESS, handleRenderEventSubscription);
    ipcMain.on(ipcChannels.NOTIFY_MAIN_PROCESS, handleRenderEventSubscription);

    return serviceConfig;
};

const getInitialLibraryState = () => {
    const tags = getTags();
    const playlists = getPlaylists();
    const collections = getCollectionsList();
    const watchFolders = getWatchFolders();
    const videoCategories = getAllVideoCategories();
    const userPreferences = userPreferenceStore.getAll();
    const hideHiddenCollections = userPreferenceStore.get('hideHiddenCollections') || false;

    return { tags, playlists, collections, watchFolders, videoCategories, userPreferences, hideHiddenCollections };
};

module.exports = {
    init,
    initSecondaryServices,
    getInitialLibraryState,
};
