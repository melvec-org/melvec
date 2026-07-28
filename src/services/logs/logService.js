const fse = require('fs-extra');
const path = require('path');
const { getLibraryErrorLogFilePath } = require('../servicePathConfig');
const { doesFileExist } = require('../service-utils/fileUtils');
const { respondSuccess, respondFailure, respondError } = require('../service-utils/sendToUI');

let libraryErrorLogFilePath = '';
let systemErrorLogFilePath = '';

const appendLogEntry = (filePath, errorMessage) => {
    if (!filePath) return;

    fse.ensureDirSync(path.dirname(filePath));
    fse.appendFileSync(filePath, `\n ${new Date().toISOString()} - ${errorMessage}\n`);
};

const initLibraryLogService = () => {
    libraryErrorLogFilePath = getLibraryErrorLogFilePath();
};

const initSystemLogService = (logDirectoryPath) => {
    systemErrorLogFilePath = path.join(logDirectoryPath, 'system-errors.log');
};

const logLibraryError = (errorMessage) => {
    appendLogEntry(libraryErrorLogFilePath, errorMessage);
};

const logSystemError = (errorMessage) => {
    appendLogEntry(systemErrorLogFilePath, errorMessage);
};

const clearLibraryLogs = () => {
    try {
        if (doesFileExist(libraryErrorLogFilePath)) {
            fse.removeSync(libraryErrorLogFilePath);
            return respondSuccess('Library logs cleared successfully.');
        }
        return respondFailure('Library error log file does not exist.');
    } catch (e) {
        return respondFailure(`Failed to clear library logs: ${e.message}`);
    }
};

const clearSystemLogs = () => {
    try {
        if (doesFileExist(systemErrorLogFilePath)) {
            fse.removeSync(systemErrorLogFilePath);

            return respondSuccess('System logs cleared successfully.');
        }

        return respondFailure('System error log file does not exist.');
    } catch (e) {
        return respondFailure(`Failed to clear system logs: ${e.message}`);
    }
};

const getLibraryLogStat = () => {
    try {
        const stats = fse.statSync(libraryErrorLogFilePath);
        return respondSuccess('', {
            size: stats.size,
            modified: stats.mtime,
        });
    } catch (e) {
        return respondError(`Failed to get library log stats: ${e.message}`);
    }
};

const getSystemLogStat = () => {
    try {
        const stats = fse.statSync(systemErrorLogFilePath);
        return respondSuccess('', {
            size: stats.size,
            modified: stats.mtime,
        });
    } catch (e) {
        return respondError(`Failed to get system log stats: ${e.message}`);
    }
};

module.exports = {
    // library level
    initLibraryLogService,
    clearLibraryLogs,
    logLibraryError,
    getLibraryLogStat,
    // system level
    initSystemLogService,
    logSystemError,
    clearSystemLogs,
    getSystemLogStat,
};
