const { contextBridge, ipcRenderer } = require('electron');
const serviceMethods = require('../constants/serviceMethods');
const ipcChannels = require('../constants/ipcChannels');
const { invokeApis } = require('./api/invokeApis');
const { ipcEventApi } = require('./api/ipcEventApi');

// cleanup all listeners in the begining of the application - to avoid memory leaks
ipcRenderer.removeAllListeners(ipcChannels.NOTIFY_RENDERER_PROCESS);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
// Note: send and receive methods for all asynchronous events where the response may take a while
// direct invoke calls are for almost all synchronous events, though it would be returning a
// promise.
contextBridge.exposeInMainWorld('api', {
    chooseVideoFileFromSystem: (operation) => ipcRenderer.invoke(serviceMethods.BROWSE_VIDEO_FILE_FROM_SYSTEM, operation),

    ...invokeApis(ipcRenderer),
    ...ipcEventApi(ipcRenderer),
});
