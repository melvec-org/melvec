/**
 * Shared IPC channel names used across renderer, preload, and main.
 *
 * Naming convention:
 * - *Request: renderer -> main request to perform an action
 * - *Action: main -> renderer notification of a user-selected action
 *
 * Keep these values centralized to avoid string duplication and to make
 * incremental IPC renames safer across the Electron boundary.
 */
const ipcChannels = {
    /**
     * Generic notify channel from main process to renderer process.
     */
    NOTIFY_RENDERER_PROCESS: 'notifyRendererProcess',

    /**
     * Generic notify channel from renderer process to main process.
     */
    NOTIFY_MAIN_PROCESS: 'notifyMainProcess',

    /**
     * Renderer requests that main build and display a context menu.
     */
    CONTEXT_MENU_REQUEST: 'contextMenuRequest',

    /**
     * Main notifies renderer which context menu action the user selected.
     */
    CONTEXT_MENU_ACTION: 'contextMenuAction',

    /**
     * Renderer requests that main open a folder/file chooser flow.
     */
    OPEN_FOLDERS_REQUEST: 'openFoldersRequest',

    /**
     * Main notifies renderer with the result of a folder/file chooser flow.
     */
    OPEN_FOLDERS_ACTION: 'openFoldersAction',

    /**
     * Renderer requests that main open a file chooser for importing a file.
     */
    IMPORT_FILE_REQUEST: 'importFileRequest',

    /**
     * Main sends imported file data back to the renderer.
     */
    IMPORT_FILE_ACTION: 'importFileAction',

    /**
     * Main notifies renderer with the result of importing a watched-folder
     * video into a collection.
     */
    IMPORTED_FROM_WATCH_FOLDER_ACTION: 'importedFromWatchFolder',

    /**
     * Main/service -> renderer event stream for incremental updates from
     * long-running operations such as exports, processing, or progress events.
     */
    EVENT_STREAM: 'eventStream',

    /**
     * Renderer requests that main save generated/exported file content.
     */
    DOWNLOAD_FILE: 'downloadFile',

    /**
     * Main notifies renderer about an application menu action.
     */
    APPLICATION_MENU_ACTION: 'applicationMenuAction',

    /**
     * Renderer requests that main open or focus the help window.
     */
    OPEN_HELP_WINDOW: 'openHelpWindow',

    /**
     * Main tells the help window to open a help topic and optionally scroll
     * to a specific section within that topic.
     */
    HELP_GOTO_SECTION: 'helpGotoSection',

    /**
     * Main notifies renderer when the BrowserWindow zoom factor changes.
     */
    ZOOM_FACTOR_CHANGE_ACTION: 'zoomFactorChanged',

    THEME_CHANGE_ACTION: 'themeChangeAction',
};

module.exports = ipcChannels;
