const serviceMethods = require('../../../constants/serviceMethods');
const {
    startExportingVideosService,
    pauseExportingVideosService,
    resumeExportingVideosService,
    stopExportingVideosService,
    exportAllMetaDataService,
    importAllMetaDataService,
    exportDatabaseService,
    importDatabaseService,
} = require('../../import-export/importExport.service');

const importExportServiceHandlers = [
    [serviceMethods.EXPORT_VIDEOS_STOP, async (trackingId) => stopExportingVideosService(trackingId)],
    [serviceMethods.EXPORT_VIDEOS_PAUSE, async (trackingId) => pauseExportingVideosService(trackingId)],
    [serviceMethods.EXPORT_VIDEOS_RESUME, async (trackingId) => resumeExportingVideosService(trackingId)],
    [serviceMethods.EXPORT_VIDEOS_START, async (config) => startExportingVideosService(config)],

    [serviceMethods.IMPORT_META_DATA, async (metaData) => importAllMetaDataService(metaData)],
    [serviceMethods.EXPORT_META_DATA, async (config) => exportAllMetaDataService(config)],

    [serviceMethods.EXPORT_DATABASE, async (targetPath) => exportDatabaseService(targetPath)],
    [serviceMethods.IMPORT_DATABASE, async (filePath) => importDatabaseService(filePath)],
];

module.exports = {
    importExportServiceHandlers,
};
