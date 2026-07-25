const serviceMethods = require('../../constants/serviceMethods');

const systemApi = (ipcRenderer) => ({
    applyTheme: (theme) => ipcRenderer.invoke(serviceMethods.SYSTEM_APPLY_THEME, theme),
    clearAllLogs: () => ipcRenderer.invoke(serviceMethods.SYSTEM_CLEAR_LOGS),
    getSystemReport: () => ipcRenderer.invoke(serviceMethods.SYSTEM_GET_REPORT),
    resetAllMetaData: () => ipcRenderer.invoke(serviceMethods.SYSTEM_RESET_META_DATA),
    clearAllActionHistory: () => ipcRenderer.invoke(serviceMethods.SYSTEM_CLEAR_ACTION_HISTORY),
    getUserPreference: (key) => ipcRenderer.invoke(serviceMethods.SYSTEM_GET_USER_PREF, key),
    setUserPreference: (key, value) => ipcRenderer.invoke(serviceMethods.SYSTEM_SET_USER_PREF, key, value),
    getAllUserPreferences: () => ipcRenderer.invoke(serviceMethods.SYSTEM_GET_ALL_USER_PREF),
    getLogs: () => ipcRenderer.invoke(serviceMethods.SYSTEM_GET_LOGS),
    getApplicationSettings: (key) => ipcRenderer.invoke(serviceMethods.SYSTEM_GET_APP_SETTINGS, key),
    setApplicationSettings: (key, value) => ipcRenderer.invoke(serviceMethods.SYSTEM_SET_APP_SETTINGS, key, value),
    resetPreferencesAndSetttings: () => ipcRenderer.invoke(serviceMethods.SYSTEM_RESET_PREFERENCES_AND_SETTINGS),
});

module.exports = {
    systemApi,
};
