const { isDev } = require('../services/service-utils/env');
const ipcChannels = require('../constants/ipcChannels');
const applicationMenuEvents = require('../events/applicationMenuEvents');
const { Menu, screen } = require('electron');

/**
 * Sends the current zoom factor to the renderer so UI state can stay in sync
 * with menu-driven zoom actions.
 *
 * @param {Electron.BrowserWindow} browserWindow - The target browser window.
 */
function notifyZoomChange(browserWindow) {
    const zoomFactor = browserWindow.webContents.getZoomFactor();
    browserWindow.webContents.send(ipcChannels.ZOOM_FACTOR_CHANGE_ACTION, zoomFactor);
}

/**
 * Builds the application menu for the main window.
 *
 * Responsibilities:
 * - creates the macOS app menu when running on macOS
 * - wires menu actions to renderer-facing application menu events
 * - handles zoom-related actions and notifies the renderer of zoom changes
 * - exposes the Help menu entry used to open the help window
 *
 * @param {Object} options - Dependencies required to build the menu.
 * @param {boolean} options.isMac - Whether the app is running on macOS.
 * @param {Function} options.getCurrentWindow - Returns the currently active main window.
 * @param {Function} options.createHelpWindow - Opens or focuses the help window.
 * @returns {Electron.Menu} The built Electron application menu instance.
 */
function buildApplicationMenu({ isMac, getCurrentWindow, createHelpWindow }) {
    const appMenuTemplate = [
        ...(isMac
            ? [
                  {
                      role: 'appMenu',
                      label: 'Melvec',
                      submenu: [
                          { role: 'about', label: 'About Melvec' },
                          { type: 'separator' },
                          { role: 'hide' },
                          { role: 'hideOthers' },
                          { role: 'unhide' },
                          { type: 'separator' },
                          {
                              role: 'settings',
                              label: 'Settings...',
                              accelerator: 'Cmd+,',
                              click: () => {
                                  const currentWindow = getCurrentWindow();
                                  if (currentWindow) {
                                      currentWindow.webContents.send(
                                          ipcChannels.APPLICATION_MENU_ACTION,
                                          applicationMenuEvents.OPEN_SETTINGS,
                                      );
                                  }
                              },
                          },
                          { type: 'separator' },
                          { role: 'quit', label: 'Quit Melvec' },
                      ],
                  },
              ]
            : []),
        {
            label: 'File',
            submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
        },
        {
            label: 'Find',
            submenu: [
                ...(isMac
                    ? [
                          {
                              role: 'find',
                              label: 'Find...',
                              accelerator: 'Cmd+F',
                              click: () => {
                                  const currentWindow = getCurrentWindow();
                                  if (currentWindow) {
                                      currentWindow.webContents.send(
                                          ipcChannels.APPLICATION_MENU_ACTION,
                                          applicationMenuEvents.START_SEARCH,
                                      );
                                  }
                              },
                          },
                      ]
                    : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
            ],
        },
        {
            label: 'View',
            submenu: [
                ...(isDev()
                    ? [
                          {
                              label: 'Refresh',
                              accelerator: 'Cmd+R',
                              role: 'forceReload',
                          },
                          { type: 'separator' },
                      ]
                    : []),
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: (menuItem, browserWindow) => {
                        if (browserWindow) {
                            browserWindow.webContents.setZoomLevel(0);
                            notifyZoomChange(browserWindow);
                        }
                    },
                },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: (menuItem, browserWindow) => {
                        if (browserWindow) {
                            let current = browserWindow.webContents.getZoomLevel();
                            const maxZoom = 1;
                            if (current < maxZoom) {
                                browserWindow.webContents.setZoomLevel(current + 0.25);
                                notifyZoomChange(browserWindow);
                            }
                        }
                    },
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: (menuItem, browserWindow) => {
                        if (browserWindow) {
                            let current = browserWindow.webContents.getZoomLevel();
                            const minZoom = -1;
                            if (current > minZoom) {
                                browserWindow.webContents.setZoomLevel(current - 0.25);
                                notifyZoomChange(browserWindow);
                            }
                        }
                    },
                },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                {
                    label: 'Toggle hidden collections',
                    accelerator: 'Cmd+Shift+H',
                    click: () => {
                        const currentWindow = getCurrentWindow();
                        if (currentWindow) {
                            currentWindow.webContents.send(
                                ipcChannels.APPLICATION_MENU_ACTION,
                                applicationMenuEvents.TOGGLE_HIDDEN_COLLECTIONS,
                            );
                        }
                    },
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Cut', accelerator: 'CommandOrControl+X', selector: 'cut:' },
                { label: 'Copy', accelerator: 'CommandOrControl+C', selector: 'copy:' },
                { label: 'Paste', accelerator: 'CommandOrControl+V', selector: 'paste:' },
                { label: 'Select All', accelerator: 'CommandOrControl+A', selector: 'selectAll:' },
            ],
        },
        {
            label: 'Go',
            submenu: [
                {
                    label: 'Go to all collections window',
                    accelerator: 'Cmd+Shift+C',
                    click: () => {
                        const currentWindow = getCurrentWindow();
                        if (currentWindow) {
                            currentWindow.webContents.send(
                                ipcChannels.APPLICATION_MENU_ACTION,
                                applicationMenuEvents.GOTO_COLLECTIONS_VIEW,
                            );
                        }
                    },
                },
                {
                    label: 'Go to all playlists window',
                    accelerator: 'Cmd+Shift+P',
                    click: () => {
                        const currentWindow = getCurrentWindow();
                        if (currentWindow) {
                            currentWindow.webContents.send(ipcChannels.APPLICATION_MENU_ACTION, applicationMenuEvents.GOTO_PLAYLISTS_VIEW);
                        }
                    },
                },
                {
                    label: 'Video Details',
                    submenu: [
                        {
                            label: 'Manage Tags',
                            accelerator: 'Cmd+T',
                            click: () => {
                                const currentWindow = getCurrentWindow();
                                if (currentWindow) {
                                    currentWindow.webContents.send(ipcChannels.APPLICATION_MENU_ACTION, applicationMenuEvents.MANGAGE_TAGS);
                                }
                            },
                        },
                        {
                            label: 'Manage Playlists',
                            accelerator: 'Cmd+P',
                            click: () => {
                                const currentWindow = getCurrentWindow();
                                if (currentWindow) {
                                    currentWindow.webContents.send(
                                        ipcChannels.APPLICATION_MENU_ACTION,
                                        applicationMenuEvents.MANAGE_PLAYLISTS,
                                    );
                                }
                            },
                        },
                        {
                            label: 'Edit File name',
                            accelerator: 'Cmd+Shift+N',
                            click: () => {
                                const currentWindow = getCurrentWindow();
                                if (currentWindow) {
                                    currentWindow.webContents.send(
                                        ipcChannels.APPLICATION_MENU_ACTION,
                                        applicationMenuEvents.EDIT_FILE_NAME,
                                    );
                                }
                            },
                        },
                        {
                            label: 'Edit title',
                            accelerator: 'Cmd+Shift+T',
                            click: () => {
                                const currentWindow = getCurrentWindow();
                                if (currentWindow) {
                                    currentWindow.webContents.send(ipcChannels.APPLICATION_MENU_ACTION, applicationMenuEvents.EDIT_TITLE);
                                }
                            },
                        },
                        {
                            label: 'Edit description',
                            accelerator: 'Cmd+Shift+D',
                            click: () => {
                                const currentWindow = getCurrentWindow();
                                if (currentWindow) {
                                    currentWindow.webContents.send(
                                        ipcChannels.APPLICATION_MENU_ACTION,
                                        applicationMenuEvents.EDIT_DESCRIPTION,
                                    );
                                }
                            },
                        },
                    ],
                },
            ],
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac
                    ? [
                          {
                              role: 'fill',
                              label: 'Fill',
                              accelerator: 'Ctrl+Opt+F',
                              click: (menuItem, browserWindow) => {
                                  if (browserWindow) {
                                      const currentDisplay = screen.getDisplayMatching(browserWindow.getBounds());
                                      const { width, height } = currentDisplay.workAreaSize;
                                      browserWindow.setSize(width - 24, height - 24, true);
                                      const { x, y } = currentDisplay.workArea;
                                      browserWindow.setPosition(
                                          Math.floor(x + (width - browserWindow.getSize()[0]) / 2),
                                          Math.floor(y + (height - browserWindow.getSize()[1]) / 2),
                                          true,
                                      );
                                  }
                              },
                          },
                          {
                              role: 'center',
                              label: 'Center',
                              accelerator: 'Ctrl+Opt+C',
                              click: (menuItem, browserWindow) => {
                                  if (browserWindow) {
                                      browserWindow.center();
                                  }
                              },
                          },
                      ]
                    : []),
                ...(isMac ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }] : [{ role: 'close' }]),
            ],
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Open Melvec help',
                    click: async () => {
                        createHelpWindow();
                    },
                },
            ],
        },
    ];

    return Menu.buildFromTemplate(appMenuTemplate);
}

/**
 * Builds and installs the application menu for the app process.
 *
 * @param {Object} options - Same options accepted by buildApplicationMenu.
 * @param {boolean} options.isMac - Whether the app is running on macOS.
 * @param {Function} options.getCurrentWindow - Returns the currently active main window.
 * @param {Function} options.createHelpWindow - Opens or focuses the help window.
 * @returns {Electron.Menu} The installed Electron menu instance.
 */
function setApplicationMenu(options) {
    const menu = buildApplicationMenu(options);
    Menu.setApplicationMenu(menu);
    return menu;
}

module.exports = {
    buildApplicationMenu,
    setApplicationMenu,
};
