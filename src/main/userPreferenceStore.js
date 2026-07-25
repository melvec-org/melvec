/**
 * user preference stores user level information, independent of any library
 * Even if user changes library path changes, user preferences will still be stored in userData folder
 * and it would be unaffected.
 *
 * It should contain -
 *  1. Library Path
 *  2. Window Transparency
 *
 * This is the main starting point of the application.
 * @type {path.PlatformPath | path}
 */

const path = require('path');
const fs = require('fs');
const electron = require('electron');
const { readJSONFile } = require('../services/service-utils/fileUtils');

const defaults = {
    windowBounds: { width: 800, height: 600 },
    libraryRootPath: '',
    libraryPath: '',
    lastUsedLibraryPaths: [],
    playlistAutoPlay: true,
    hideHiddenCollections: false,
    viewPreference: {
        browserVideoListViewType: 'list',
    },
    theme: 'system',
    transparentWindowMode: false,
    hideNsfwContent: false,
    showVideoPreviewOnHover: false,
    isAISupported: false,

    isAIEnabled: false,
    ai: {
        modelTier: 'standard',
        isDownloaded: false,
    },
};

const USER_PREFERENCE_VALIDATORS = {
    windowBounds: (value) => typeof value === 'object' && value !== null && Number.isInteger(value.width) && Number.isInteger(value.height),
    libraryPath: (value) => typeof value === 'string',
    libraryRootPath: (value) => typeof value === 'string',
    lastUsedLibraryPaths: (value) => Array.isArray(value) && value.every((item) => typeof item === 'string'),

    playlistAutoPlay: (value) => typeof value === 'boolean',
    hideHiddenCollections: (value) => typeof value === 'boolean',

    viewPreference: (value) => typeof value === 'object' && value !== null && typeof value.browserVideoListViewType === 'string',

    theme: (value) => ['light', 'dark', 'system'].includes(value),
    transparentWindowMode: (value) => typeof value === 'boolean',
    hideNsfwContent: (value) => typeof value === 'boolean',
    showVideoPreviewOnHover: (value) => typeof value === 'boolean',
    isAISupported: (value) => typeof value === 'boolean',
    isAIEnabled: (value) => typeof value === 'boolean',

    ai: (value) =>
        typeof value === 'object' &&
        value !== null &&
        ['basic', 'standard', 'advanced'].includes(value.modelTier) &&
        typeof value.isDownloaded === 'boolean',
};

class UserPreferenceStore {
    /**
     * Read the configuration file from userData folder of application user
     * @param options
     */
    constructor(options) {
        const userDataPath = electron.app.getPath('userData');
        this.path = path.join(userDataPath, options.configName + '.json');
        this.data = readJSONFile(this.path, options.defaults);
    }

    get(key) {
        return this.data[key];
    }

    set(key, val) {
        const validator = USER_PREFERENCE_VALIDATORS[key];

        if (!validator || !validator(val)) {
            console.error(`Rejected invalid user preference update for key: ${key}`);
            return this.data;
        }

        this.data[key] = val;
        fs.writeFileSync(this.path, JSON.stringify(this.data));
        return this.data;
    }

    getAll() {
        return this.data;
    }

    reset() {
        fs.writeFileSync(this.path, JSON.stringify(defaults));
        this.data = defaults;
    }
}

const userPreferenceStore = new UserPreferenceStore({
    configName: 'userPreferences',
    defaults: defaults,
});

module.exports = userPreferenceStore;
