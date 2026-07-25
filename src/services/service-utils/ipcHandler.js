const { ipcMain } = require('electron');

/**
 * Register a handler safely — it removes any existing one before adding.
 * @param {string} channel - IPC channel identifier.
 * @param {Function} handler - Function that will handle incoming IPC calls.
 * @param {boolean} isAsync - Whether to use async handling style.
 */
function registerIpcHandler(channel, handler, isAsync = false) {
    if (typeof channel !== 'string' || channel.trim() === '' || typeof handler !== 'function') {
        return;
    }

    ipcMain.removeHandler(channel);

    if (isAsync) {
        ipcMain.handle(channel, async (event, ...args) => handler(...args));
    } else {
        ipcMain.handle(channel, (event, ...args) => handler(...args));
    }
}

module.exports = {
    registerIpcHandler,
};
