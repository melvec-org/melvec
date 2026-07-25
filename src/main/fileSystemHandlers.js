const rendererEvents = require('../events/rendererEvents');

const { dialog } = require('electron');
const { readJSONFile } = require('../services/service-utils/fileUtils');
const mainThreadEvents = require('../events/mainThreadEvents');
const ipcChannels = require('../constants/ipcChannels');
const { emitToUI } = require('../services/service-utils/sendToUI');

const genericFolderOpenSelectionErrorHandler = (err) => {
    dialog.showMessageBox({
        type: 'error',
        title: 'Error',
        message: `Error occurred while selecting the folder: ${err.message}`,
    });
};

const openImportAllMetaDataFolder = (webContents) => {
    const options = {
        title: 'Choose a JSON file to import',
        defaultPath: '',
        buttonLabel: 'Import this file',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile'],
    };
    dialog
        .showOpenDialog(options)
        .then((result) => {
            if (!result.canceled) {
                const path = readJSONFile(result.filePaths[0]);
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_METADATA_IMPORT_FOLDER_SELECTED,
                    payload: path,
                });
            } else {
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_METADATA_IMPORT_FOLDER_SELECTED,
                    payload: null,
                });
            }
        })
        .catch((err) => genericFolderOpenSelectionErrorHandler(err));
};

const openDBImportFolder = (webContents) => {
    const options = {
        title: 'Choose a DB file to import',
        defaultPath: '',
        buttonLabel: 'Import this file',
        filters: [{ name: 'DB Files', extensions: ['db'] }],
        properties: ['openFile'],
    };
    dialog
        .showOpenDialog(options)
        .then((result) => {
            if (!result.canceled) {
                const dbPath = result.filePaths[0];
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_DB_IMPORT_FILE_SELECTED,
                    payload: dbPath,
                });
            } else {
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_DB_IMPORT_FILE_SELECTED,
                    payload: null,
                });
            }
        })
        .catch((err) => genericFolderOpenSelectionErrorHandler(err));
};

const openBackupFolder = (webContents) => {
    const options = {
        title: 'Choose a backup folder',
        defaultPath: '',
        buttonLabel: 'Save here',
        filters: [],
        properties: ['openDirectory', 'createDirectory'],
    };
    dialog
        .showOpenDialog(options)
        .then((result) => {
            if (!result.canceled) {
                const backupFolderPath = result.filePaths[0];
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_BACKUP_FOLDER_SELECTED,
                    payload: backupFolderPath,
                });
            } else {
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_BACKUP_FOLDER_SELECTED,
                    payload: null,
                });
            }
        })
        .catch((err) => genericFolderOpenSelectionErrorHandler(err));
};

const openExportFolder = (webContents) => {
    const options = {
        title: 'Choose a folder to export',
        defaultPath: '',
        buttonLabel: 'Export to this directory',
        filters: [],
        properties: ['openDirectory', 'createDirectory'],
    };
    dialog
        .showOpenDialog(options)
        .then((result) => {
            if (!result.canceled) {
                const exportFolderPath = result.filePaths[0];

                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_EXPORT_FOLDER_SELECTED,
                    payload: exportFolderPath,
                });
            } else {
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_EXPORT_FOLDER_SELECTED,
                    payload: null,
                });
            }
        })
        .catch((err) => genericFolderOpenSelectionErrorHandler(err));
};

const openLocalModelsFolder = (webContents) => {
    const options = {
        title: 'Choose the folder with downloaded models',
        defaultPath: '',
        buttonLabel: 'Select to this directory',
        filters: [],
        properties: ['openDirectory'],
    };
    dialog
        .showOpenDialog(options)
        .then((result) => {
            if (!result.canceled) {
                const importFolderPath = result.filePaths[0];

                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_AI_LOCAL_IMPORT_DIR_SELECT,
                    payload: importFolderPath,
                });
            } else {
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_AI_LOCAL_IMPORT_DIR_SELECT,
                    payload: null,
                });
            }
        })
        .catch((err) => genericFolderOpenSelectionErrorHandler(err));
};

const openWatchFolder = (webContents) => {
    const options = {
        title: 'Choose a folder to watch',
        defaultPath: '',
        buttonLabel: 'Add to watch',
        filters: [],
        properties: ['openDirectory', 'createDirectory'],
    };
    dialog
        .showOpenDialog(options)
        .then((result) => {
            if (!result.canceled) {
                const watchFolderPath = result.filePaths[0];

                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_WATCH_FOLDER_SELECTED,
                    payload: watchFolderPath,
                });
            } else {
                webContents.send(ipcChannels.OPEN_FOLDERS_ACTION, {
                    event: mainThreadEvents.ON_WATCH_FOLDER_SELECTED,
                    payload: null,
                });
            }
        })
        .catch((err) => genericFolderOpenSelectionErrorHandler(err));
};

/**
 * Opens a native file picker for selecting a single video file.
 *
 * @param {Object} options - Handler dependencies.
 * @param {Electron.Dialog} options.dialog - Electron dialog module.
 * @returns {Promise<string|null>} The selected file path, or null if canceled.
 */
async function browseVideoFileFromSystem({ dialog }) {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi'] }],
    });

    if (result.canceled) return null;
    return result.filePaths[0];
}

const selectLibraryRootPath = async () => {
    const options = {
        title: 'Choose the library root folder',
        defaultPath: '',
        buttonLabel: 'Set this as root folder',
        filters: [],
        properties: ['openDirectory', 'createDirectory'],
    };
    try {
        const result = await dialog.showOpenDialog(options);
        if (result.canceled || !result.filePaths?.length) {
            return;
        }

        const [selectedLibraryPath] = result.filePaths;

        return selectedLibraryPath;
    } catch (err) {
        emitToUI(mainThreadEvents.ON_IMPORT_FAILURE, {
            errorDetails: err?.message || 'Failed to select library folder.',
        });
    }
};

/**
 * Dispatches folder-opening requests from the renderer to the correct
 * bootstrap/main-process handler.
 *
 * This keeps event-to-handler mapping outside of main.js and centralizes
 * the logic for folder selection / folder-opening related IPC actions.
 *
 * @param {Object} options - Handler dependencies and request payload.
 * @param {Object} options.arg - Renderer payload containing the requested event name.
 * @param {string} options.arg.event - The renderer event identifier.
 * @param {Electron.WebContents} options.webContents - Target renderer webContents.
 * @returns {void}
 */
function handleOpenFolders({ arg, webContents }) {
    const targetFunctions = {};
    targetFunctions[rendererEvents.OPEN_WATCH_FOLDER] = openWatchFolder;
    targetFunctions[rendererEvents.OPEN_BACKUP_FOLDER] = openBackupFolder;
    targetFunctions[rendererEvents.OPEN_DB_TO_IMPORT] = openDBImportFolder;
    targetFunctions[rendererEvents.OPEN_EXPORT_FOLDER] = openExportFolder;
    targetFunctions[rendererEvents.OPEN_LOCAL_MODELS_FOLDER] = openLocalModelsFolder;
    targetFunctions[rendererEvents.OPEN_METADATA_FILE_TO_IMPORT] = openImportAllMetaDataFolder;

    if (targetFunctions[arg.event]) {
        targetFunctions[arg.event](webContents);
    } else {
        console.error(`Unknown event: ${arg.event}`);
    }
}

module.exports = {
    browseVideoFileFromSystem,
    handleOpenFolders,
    selectLibraryRootPath,
};
