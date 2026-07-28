const ipcChannels = require('../../constants/ipcChannels');

// Registry mapping original callback → stripped wrapper, keyed by channel.
// Enables stop() to remove the exact wrapper registered by receive().
const listenerRegistry = new Map();

const sendChannels = [
    ipcChannels.NOTIFY_MAIN_PROCESS,
    ipcChannels.CONTEXT_MENU_REQUEST,
    ipcChannels.DOWNLOAD_FILE,
    ipcChannels.IMPORT_FILE_REQUEST,
    ipcChannels.OPEN_FOLDERS_REQUEST,
    ipcChannels.OPEN_HELP_WINDOW,
    ipcChannels.APP_WINDOWS_ACTION,
];

const receiveChannels = [
    ipcChannels.NOTIFY_RENDERER_PROCESS,
    ipcChannels.IMPORT_FILE_ACTION,
    ipcChannels.OPEN_FOLDERS_ACTION,
    ipcChannels.APPLICATION_MENU_ACTION,
    ipcChannels.CONTEXT_MENU_ACTION,
    ipcChannels.ZOOM_FACTOR_CHANGE_ACTION,
    ipcChannels.EVENT_STREAM,
    ipcChannels.THEME_CHANGE_ACTION,
    ipcChannels.APP_WINDOWS_ACTION,
];

const receiveOnceChannels = [
    ipcChannels.CONTEXT_MENU_ACTION,
    ipcChannels.IMPORTED_FROM_WATCH_FOLDER_ACTION,
    ipcChannels.OPEN_FOLDERS_ACTION,
    ipcChannels.NOTIFY_RENDERER_PROCESS,
];

const ipcEventApi = (ipcRenderer) => ({
    send: (channel, data) => {
        if (sendChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },

    /**
     * Allowed main -> renderer subscription channels.
     *
     * Convention:
     * - `Action` is used for user-selected commands coming back from main
     * - `Event`/legacy names are retained until migrated
     */
    receive: (channel, func) => {
        if (receiveChannels.includes(channel)) {
            const wrapper = (event, ...args) => func(...args);
            const key = `${channel}::${func}`;
            listenerRegistry.set(key, wrapper);
            ipcRenderer.on(channel, wrapper);
        }
    },

    receiveOnce: (channel, func) => {
        if (receiveOnceChannels.includes(channel)) {
            ipcRenderer.once(channel, (event, ...args) => func(...args));
        }
    },

    stop: (channel, func) => {
        if (receiveChannels.includes(channel)) {
            const key = `${channel}::${func}`;
            const wrapper = listenerRegistry.get(key);
            if (wrapper) {
                ipcRenderer.off(channel, wrapper);
                listenerRegistry.delete(key);
            }
        }
    },
});

module.exports = {
    ipcEventApi,
};
