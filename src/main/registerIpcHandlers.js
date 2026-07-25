const ipcChannels = require('../constants/ipcChannels');
const serviceMethods = require('../constants/serviceMethods');
const { showContextMenu } = require('./contextMenu');
const { switchLibrary, openLibrarySelection } = require('./bootstrap');

const { browseVideoFileFromSystem, handleOpenFolders } = require('./fileSystemHandlers');
const { writeJSONFile, readJSONFile } = require('../services/service-utils/fileUtils');

const { BrowserWindow, dialog, shell, Menu } = require('electron');
const { logSystemError } = require('../services/logs/logService');
const rendererEvents = require('../events/rendererEvents');

const registerIpcHandlers = ({ ipcMain, getCurrentWindow, getHelpWindow, createHelpWindow }) => {
    ipcMain.on(ipcChannels.IMPORT_FILE_REQUEST, (event, eventData) => {
        let options = {
            title: eventData.title,
            filters: eventData.filters,
            buttonLabel: 'select',
            properties: ['openFile'],
        };

        dialog
            .showOpenDialog(options)
            .then((result) => {
                if (result.canceled) return;

                const data = readJSONFile(result.filePaths[0]);

                event.sender.send(ipcChannels.IMPORT_FILE_ACTION, {
                    eventInitiator: eventData.eventInitiator,
                    payload: data,
                });
            })
            .catch((err) => {
                const message = `Error occurred while importing file: ${err.message}`;
                console.error(message, err);
                logSystemError(message);
            });
    });

    /**
     * this is for downloading any files, we will make things configurable
     * later - right now it's only for saving tags and playlist
     * This download is not from the web but from the app itself.
     */
    ipcMain.on(ipcChannels.DOWNLOAD_FILE, (event, eventData) => {
        dialog
            .showSaveDialog(getCurrentWindow(), {
                title: eventData.title,
                defaultPath: eventData.fileName,
                filters: eventData.filters,
            })
            .then((result) => {
                if (!result.canceled) {
                    writeJSONFile(result.filePath, eventData.fileContent);
                }
            })
            .catch((err) => {
                const message = `Save dialog failed: ${err.message}`;
                console.error(message, err);
                logSystemError(message);
            });
    });

    ipcMain.on(ipcChannels.NOTIFY_MAIN_PROCESS, (event, arg) => {
        const currentWindow = getCurrentWindow();

        if (arg.event === 'maximizeWindow') {
            if (currentWindow) {
                currentWindow.maximize();
            }
            return;
        }
    });

    ipcMain.handle(serviceMethods.BROWSE_VIDEO_FILE_FROM_SYSTEM, async () => browseVideoFileFromSystem({ dialog }));

    ipcMain.on(ipcChannels.OPEN_FOLDERS_REQUEST, (event, arg) => {
        const currentWindow = getCurrentWindow();

        if (!currentWindow) return;
        if (arg.event === rendererEvents.OPEN_ROOT_LIBRARY_SELECTOR) {
            openLibrarySelection(currentWindow.webContents);
        } else if (arg.event === rendererEvents.SELECT_LIBRARY_PATH) {
            switchLibrary(arg.selectedPath, currentWindow.webContents);
        } else {
            handleOpenFolders({
                arg,
                webContents: currentWindow.webContents,
            });
        }
    });

    ipcMain.on('contextMenu', (event, arg) => {
        showContextMenu({
            event,
            arg,
            BrowserWindow,
            Menu,
            shell,
        });
    });

    ipcMain.on(ipcChannels.CONTEXT_MENU_REQUEST, (event, arg) => {
        showContextMenu({
            event,
            arg,
            BrowserWindow,
            Menu,
            shell,
        });
    });

    ipcMain.on(ipcChannels.OPEN_HELP_WINDOW, (evt, targetId) => {
        let helpWindow = getHelpWindow();

        if (!helpWindow) {
            createHelpWindow();
            helpWindow = getHelpWindow();
        } else {
            helpWindow.focus();
        }

        if (helpWindow) {
            helpWindow.webContents.send(ipcChannels.HELP_GOTO_SECTION, targetId);
        }
    });
};
module.exports = { registerIpcHandlers };
