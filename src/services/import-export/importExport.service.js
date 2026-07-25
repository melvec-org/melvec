const { startExportingVideos, pauseExportingVideos, resumeExportingVideos, stopExportingVideos } = require('./exportVideos');
const { importAllMetaData, exportAllMetaData } = require('./backupMetaData');
const { importDatabaseService, exportDatabaseService } = require('../database/backupDatabaseService');
const { respondError, respondSuccess, respondFailure } = require('../service-utils/sendToUI');
const responseStatus = require('../../constants/responseStatus');

const startDatabaseBackupService = async (targetPath) => {
    try {
        exportDatabaseService(targetPath);
        return respondSuccess(`Database backup started.`);
    } catch (error) {
        logLibraryError(`Error in taking database backup: ${error.message}`);
    }
};

const startImportDatabaseService = async (sourcePath) => {
    try {
        importDatabaseService(sourcePath);
        return respondSuccess(`Database import started.`);
    } catch (error) {
        logLibraryError(`Error in importing database from ${sourcePath}: ${error.message}`);
        return respondError(`Error in importing database from ${sourcePath}: ${error.message}`);
    }
};

const importAllMetaDataService = async (metaData) => {
    try {
        await importAllMetaData(metaData);
        return respondSuccess(`All metadata imported.`);
    } catch (error) {
        logLibraryError(`Error in importing metadata.`);
        return respondError(`Error in importing metadata.`);
    }
};

const exportAllMetaDataService = async (config) => {
    try {
        const response = await exportAllMetaData();
        if (response.status === responseStatus.SUCCESS) {
            return respondSuccess('All metadata generated', response.data);
        } else {
            return respondFailure('Failed to generate metadata', response.message);
        }
    } catch (error) {
        return respondError(`Error in exporting metadata: ${error.message}`);
    }
};

module.exports = {
    // video
    startExportingVideosService: startExportingVideos,
    pauseExportingVideosService: pauseExportingVideos,
    resumeExportingVideosService: resumeExportingVideos,
    stopExportingVideosService: stopExportingVideos,
    stopExportingVideosService: stopExportingVideos,

    // metadata
    importAllMetaDataService,
    exportAllMetaDataService,

    // database
    importDatabaseService: startImportDatabaseService,
    exportDatabaseService: startDatabaseBackupService,
};
