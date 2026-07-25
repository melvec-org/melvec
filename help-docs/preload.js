const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('helpApi', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
});
