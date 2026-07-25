const serviceMethods = require('../../../constants/serviceMethods');
const { getLogStat } = require('../../logs/logService');
const { clearAllLogs, getSystemReportService, resetAllMetaDataService, resetPreferencesAndSettings } = require('../../global.service');
const { applyAndPersistTheme } = require('../../../main/theme');
const { clearAllActionHistory } = require('../../history/actionHistory.service');
const { getApplicationSettings, setApplicationSettings } = require('../../application-settings/applicationSettings.service');
const userPreferenceStore = require('../../../main/userPreferenceStore');

const { validateApplicationSettingUpdate, validateTheme, validateUserPreferenceUpdate } = require('../../service-utils/ipcValidation');

const systemServiceHandlers = [
    [serviceMethods.SYSTEM_GET_LOGS, async () => getLogStat()],
    [serviceMethods.SYSTEM_CLEAR_LOGS, async () => clearAllLogs()],
    [serviceMethods.SYSTEM_GET_REPORT, async () => getSystemReportService()],
    [serviceMethods.SYSTEM_RESET_META_DATA, async () => resetAllMetaDataService()],
    [serviceMethods.SYSTEM_CLEAR_ACTION_HISTORY, async () => clearAllActionHistory()],

    [serviceMethods.SYSTEM_GET_APP_SETTINGS, (key) => getApplicationSettings(key)],
    [
        serviceMethods.SYSTEM_SET_APP_SETTINGS,
        (key, value) => {
            const validationError = validateApplicationSettingUpdate(key, value);
            if (validationError) {
                return validationError;
            }

            return setApplicationSettings(key, value);
        },
    ],

    [serviceMethods.SYSTEM_GET_USER_PREF, (key) => userPreferenceStore.get(key)],
    [
        serviceMethods.SYSTEM_SET_USER_PREF,
        (key, value) => {
            const validationError = validateUserPreferenceUpdate(key, value);
            if (validationError) {
                return validationError;
            }

            return userPreferenceStore.set(key, value);
        },
    ],
    [serviceMethods.SYSTEM_GET_ALL_USER_PREF, async () => userPreferenceStore.getAll()],

    [serviceMethods.SYSTEM_RESET_PREFERENCES_AND_SETTINGS, async () => resetPreferencesAndSettings()],
    [
        serviceMethods.SYSTEM_APPLY_THEME,
        async (theme) => {
            const validationError = validateTheme(theme);
            if (validationError) {
                return validationError;
            }

            return applyAndPersistTheme(theme);
        },
    ],
];

module.exports = {
    systemServiceHandlers,
};
