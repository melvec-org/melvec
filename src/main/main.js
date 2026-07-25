const { app, BrowserWindow, globalShortcut, ipcMain, systemPreferences } = require('electron');
const { setApplicationMenu } = require('./applicationMenu');

// Disable some the default macOS menu items for good.
// Disable Dictation menu item
systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
// Disable Emoji & Symbols (Character Palette) menu item
systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);

const { beforeAppQuit } = require('./bootstrap');
const { initSystemLogService } = require('../services/logs/logService');
const { registerDownloadsHandlers } = require('../services/service-utils/registerDownloadsHandlers');
const { registerIpcHandlers } = require('./registerIpcHandlers');
const { createWindow, createHelpWindow } = require('./windows');

const isMac = process.platform === 'darwin';
const isDev = !app.isPackaged;

let currentWindow = null;
let helpWindow;

app.whenReady().then(() => {
    initSystemLogService(app.getPath('userData'));

    createWindow({
        app,
        isDev,
        onWindowCreated: (win) => {
            currentWindow = win;
        },
    });

    const openHelpWindow = () =>
        createHelpWindow({
            app,
            isDev,
            getHelpWindow: () => helpWindow,
            setHelpWindow: (win) => {
                helpWindow = win;
            },
        });

    setApplicationMenu({
        isMac,
        getCurrentWindow: () => currentWindow,
        createHelpWindow: openHelpWindow,
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow({
                app,
                isDev,
                onWindowCreated: (win) => {
                    currentWindow = win;
                },
            });
        }
    });

    globalShortcut.register('F12', () => {
        if (currentWindow) {
            currentWindow.webContents.toggleDevTools();
        }
    });

    registerDownloadsHandlers({
        ipcMain,
        getCurrentWindow: () => currentWindow,
    });

    registerIpcHandlers({
        ipcMain,
        getCurrentWindow: () => currentWindow,
        getHelpWindow: () => helpWindow,
        createHelpWindow: openHelpWindow,
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async (event) => {
    event.preventDefault(); // Prevent default quit to allow async task to complete
    await beforeAppQuit();
    app.exit(); // Manually quit the app after async task completes
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
