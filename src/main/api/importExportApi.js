const serviceMethods = require('../../constants/serviceMethods');
const importExportApi = (ipcRenderer) => ({
    // videos
    startExportingVideos: (config) => ipcRenderer.invoke(serviceMethods.EXPORT_VIDEOS_START, config),
    stopExportingVideos: (trackingId) => ipcRenderer.invoke(serviceMethods.EXPORT_VIDEOS_STOP, trackingId),
    pauseExportingVideos: (trackingId) => ipcRenderer.invoke(serviceMethods.EXPORT_VIDEOS_PAUSE, trackingId),
    resumeExportingVideos: (trackingId) => ipcRenderer.invoke(serviceMethods.EXPORT_VIDEOS_RESUME, trackingId),

    // database and others
    importDatabase: (filePath) => ipcRenderer.invoke(serviceMethods.IMPORT_DATABASE, filePath),
    startDatabaseBackup: (targetDir) => ipcRenderer.invoke(serviceMethods.EXPORT_DATABASE, targetDir),

    // metadata
    importAllMetaData: (metaData) => ipcRenderer.invoke(serviceMethods.IMPORT_META_DATA, metaData),
    exportAllMetaData: (config) => ipcRenderer.invoke(serviceMethods.EXPORT_META_DATA, config),
});
module.exports = { importExportApi };
