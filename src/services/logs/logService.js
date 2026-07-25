const fse = require('fs-extra');
const path = require('path');
const { getLibraryErrorLogFilePath } = require('../servicePathConfig');
const { doesFileExist } = require('../service-utils/fileUtils');

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
            return {
                status: 'success',
                message: 'Library logs cleared successfully.',
            };
        }

        return {
            status: 'error',
            message: 'Library error log file does not exist.',
        };
    } catch (e) {
        return {
            status: 'error',
            message: `Failed to clear library logs: ${e.message}`,
        };
    }
};

const clearSystemLogs = () => {
    try {
        if (doesFileExist(systemErrorLogFilePath)) {
            fse.removeSync(systemErrorLogFilePath);
            return {
                status: 'success',
                message: 'System logs cleared successfully.',
            };
        }

        return {
            status: 'error',
            message: 'System error log file does not exist.',
        };
    } catch (e) {
        return {
            status: 'error',
            message: `Failed to clear system logs: ${e.message}`,
        };
    }
};

const getLibraryLogStat = () => {
    try {
        const stats = fse.statSync(libraryErrorLogFilePath);
        return {
            status: 'success',
            size: stats.size,
            modified: stats.mtime,
        };
    } catch (e) {
        return {
            status: 'error',
            message: `Failed to get library log stats: ${e.message}`,
        };
    }
};

const getSystemLogStat = () => {
    try {
        const stats = fse.statSync(systemErrorLogFilePath);
        return {
            status: 'success',
            size: stats.size,
            modified: stats.mtime,
        };
    } catch (e) {
        return {
            status: 'error',
            message: `Failed to get system log stats: ${e.message}`,
        };
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
