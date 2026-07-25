const { backupDatabase, importDatabase } = require('./database');
const mainThreadEvents = require('../../events/mainThreadEvents');
const { emitToUI } = require('../service-utils/sendToUI');
const responseStatus = require('../../constants/responseStatus');

const exportDatabaseService = (targetFolder) => {
    const status = backupDatabase(targetFolder);
    if (status) {
        emitToUI(mainThreadEvents.ON_DATABASE_BACKUP_COMPLETE, {
            status: responseStatus.SUCCESS,
            message: `Backup completed successfully in ${targetFolder}`,
        });
    } else {
        emitToUI(mainThreadEvents.ON_DATABASE_BACKUP_COMPLETE, {
            status: 'error',
            message: 'Backup failed',
        });
    }
};

const importDatabaseService = (filePath) => {
    const importResult = importDatabase(filePath);

    if (importResult.status === responseStatus.SUCCESS) {
        emitToUI(mainThreadEvents.ON_DATABASE_IMPORT_COMPLETE, {
            status: responseStatus.SUCCESS,
            message: importResult.message,
        });
    } else {
        emitToUI(mainThreadEvents.ON_DATABASE_IMPORT_COMPLETE, {
            status: 'error',
            message: importResult.message,
        });
    }
};

module.exports = {
    exportDatabaseService,
    importDatabaseService,
};
