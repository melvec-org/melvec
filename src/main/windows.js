const { BrowserWindow, nativeTheme } = require('electron');
const path = require('node:path');
const { bootstrap } = require('./bootstrap');
const { injectSystemTheme } = require('./theme');
const userPreferenceStore = require('./userPreferenceStore');

function createWindow({ app, isDev, onWindowCreated }) {
    const win = new BrowserWindow({
        width: 1050,
        height: 600,
        minWidth: 750,
        minHeight: 600,
        title: 'Melvec',
        backgroundColor: '#00000000',
        transparent: true,
        vibrancy: 'under-window',
        visualEffectState: 'active',
        backgroundMaterial: 'under-window',
        frame: false,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 12, y: 18 },
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(__dirname, '../../dist/preload.bundle.js'),
        },
        zoomFactor: 1,
    });

    onWindowCreated(win);

    win.maximize();
    if (isDev) {
        win.webContents.openDevTools();
    }

    nativeTheme.themeSource = userPreferenceStore.get('theme') || 'system';

    const indexHtmlPath = isDev ? path.join(__dirname, '../../dist/index.html') : path.join(app.getAppPath(), 'dist', 'index.html');

    win.loadFile(indexHtmlPath);

    win.webContents.on('dom-ready', () => {
        injectSystemTheme(win.webContents);
    });

    win.webContents.on('did-finish-load', () => {
        global.webContents = win.webContents;
        bootstrap(win.webContents);
    });

    win.webContents.on('zoom-changed', () => {});
    win.on('enter-full-screen', () => {});
    win.on('leave-full-screen', () => {});

    return win;
}

function createHelpWindow({ app, isDev, getHelpWindow, setHelpWindow }) {
    const existingHelpWindow = getHelpWindow();
    if (existingHelpWindow) {
        existingHelpWindow.focus();
        return existingHelpWindow;
    }

    const helpWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        title: 'Help Documentation',
        webPreferences: {
            preload: path.join(__dirname, '../../help-docs/preload.js'),
            contextIsolation: true,
        },
    });

    setHelpWindow(helpWindow);

    const helpHtmlPath = isDev ? path.join(__dirname, '../../help.html') : path.join(app.getAppPath(), 'help.html');

    helpWindow.loadFile(helpHtmlPath);

    helpWindow.on('closed', () => {
        setHelpWindow(null);
    });

    return helpWindow;
}

module.exports = {
    createWindow,
    createHelpWindow,
};
