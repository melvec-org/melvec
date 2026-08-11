const contextMenuEvents = require('../events/contextMenuEvents');
const ipcChannels = require('../constants/ipcChannels');
const { isNonEmptyString } = require('../services/service-utils/ipcValidation');
const mediaTypes = require('../constants/mediaTypes');

/**
 * Builds and shows a context menu based on the renderer-provided source.
 *
 * Supported sources currently include:
 * - librarySidebarCollectionItem
 * - librarySidebar
 * - video
 * - playlistVideoTile
 *
 * Responsibilities:
 * - maps a renderer context source to the correct Electron menu template
 * - sends selected menu actions back to the renderer on the shared
 *   `CONTEXT_MENU_ACTION` IPC channel
 * - performs native shell actions such as revealing a file in Finder
 *
 * @param {Object} options - Context menu dependencies and payload.
 * @param {Electron.IpcMainEvent} options.event - IPC event from the renderer.
 * @param {Object} options.arg - Renderer payload describing the requested menu.
 * @param {string} options.arg.source - Source identifier for the menu request.
 * @param {typeof import('electron').BrowserWindow} options.BrowserWindow - Electron BrowserWindow module.
 * @param {typeof import('electron').Menu} options.Menu - Electron Menu module.
 * @param {typeof import('electron').shell} options.shell - Electron shell module.
 * @returns {void}
 */
function showContextMenu({ event, arg, BrowserWindow, Menu, shell }) {
    if (arg.source === 'librarySidebarCollectionItem') {
        const isHidden = arg.collectionItem.isHidden;
        const canRename = arg.collectionItem.label !== 'Default collection';
        const collectionItemMenuTemplate = [
            {
                label: 'Rename collection',
                enabled: canRename,
                click: () => {
                    event.sender.send(ipcChannels.CONTEXT_MENU_ACTION, contextMenuEvents.RENAME_COLLECTION, arg.collectionItem);
                },
            },
            { type: 'separator' },
            {
                label: isHidden ? 'Unhide collection' : 'Hide collection',
                click: () => {
                    event.sender.send(ipcChannels.CONTEXT_MENU_ACTION, contextMenuEvents.TOGGLE_IS_HIDDEN, arg.collectionItem);
                },
            },
        ];

        const menu = Menu.buildFromTemplate(collectionItemMenuTemplate);
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
        return;
    }

    if (arg.source === 'librarySidebar') {
        const template = [
            {
                label: 'Add a new collection',
                click: () => {
                    event.sender.send(ipcChannels.CONTEXT_MENU_ACTION, contextMenuEvents.ADD_NEW_COLLECTION);
                },
            },
            { type: 'separator' },
            {
                label: 'Toggle Collapse',
                click: () => {
                    event.sender.send(ipcChannels.CONTEXT_MENU_ACTION, contextMenuEvents.TOGGLE_SECTION);
                },
            },
        ];

        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
        return;
    }

    if (arg.source === mediaTypes.VIDEO) {
        const fullVideoPath = arg?.data?.path;
        if (!isNonEmptyString(fullVideoPath)) {
            console.error('Rejected invalid video path for context menu reveal action');
            return;
        }

        const template = [
            {
                label: 'Reveal in finder',
                click: () => {
                    shell.showItemInFolder(fullVideoPath);
                },
            },
        ];

        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
        return;
    }

    if (arg.source === 'playlistVideoTile') {
        const template = [
            {
                label: 'Remove from playlist',
                click: () => {
                    event.sender.send(ipcChannels.CONTEXT_MENU_ACTION, contextMenuEvents.REMOVE_FROM_PLAYLIST, arg.source, arg.data);
                },
            },
        ];

        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
    }
}

module.exports = {
    showContextMenu,
};
