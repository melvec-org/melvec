/**
 * Application settings service
 *
 * This service handles the application settings data and provides methods to get and set them.
 * It also provides a debounce mechanism to update the database file every 50 milliseconds.
 * Application settings is different than userPrefences which is stored at the user level. ApplicationSettings are stored at the application level.
 * Each library is has separate ApplicationSettings file. The application settings file is stored in the library's root directory.
 *
 * settings such as which tab is opened, which playlist is selected, which window is focused, etc. are stored in the application settings.
 *
 * The get and set calls are synchronous eventhough the setting is saved to the database file every 50 milliseconds.
 */

const { getDbPath, dbFileNames } = require('../servicePathConfig');
const { writeJSONFile, checkAndCreateJsonFileSync } = require('../service-utils/fileUtils');
const debounce = require('../service-utils/debounce');

let applicationSettingsData = {};
let applicationSettingsDbPath = '';
let DEBOUNCE_DURATION = 50;

const isValidApplicationSettingValue = (value) => {
    if (value === undefined) return false;
    if (typeof value === 'function') return false;
    if (typeof value === 'symbol') return false;
    return true;
};

/**
 * Update the application settings database file with the current application settings data.
 */
const updateApplicationSettingsDb = () => {
    if (applicationSettingsDbPath !== '') {
        writeJSONFile(applicationSettingsDbPath, applicationSettingsData);
    }
};

const debouncedUpdateDb = debounce(updateApplicationSettingsDb, DEBOUNCE_DURATION);

/**
 * Get the value for a given key from the application settings.
 * @param key
 * @returns {null}
 */
const getApplicationSettings = (key) => {
    if (typeof key !== 'string' || key.trim() === '') return null;
    if (applicationSettingsData.hasOwnProperty(key)) {
        return applicationSettingsData[key];
    }
    return null;
};

/**
 * Set the value for a given key in the application settings.
 * @param key
 * @param value
 */
const setApplicationSettings = (key, value) => {
    if (typeof key !== 'string' || key.trim() === '') {
        return null;
    }

    if (!isValidApplicationSettingValue(value)) {
        return null;
    }

    applicationSettingsData[key] = value;

    debouncedUpdateDb();
    return applicationSettingsData[key];
};

const resetApplicationSettings = () => {
    applicationSettingsData = {};
    debouncedUpdateDb();
};

/**
 * Initialize the application settings service.
 * This method reads the application settings from the database file and sets them as the initial application settings data.
 */
const initApplicationSettings = () => {
    applicationSettingsDbPath = getDbPath(dbFileNames.APPLICATION_SETTINGS);
    applicationSettingsData = checkAndCreateJsonFileSync(applicationSettingsDbPath, {});
};

// Exports the methods for interacting with the application settings.
module.exports = {
    initApplicationSettings,
    getApplicationSettings,
    setApplicationSettings,
    resetApplicationSettings,
};
