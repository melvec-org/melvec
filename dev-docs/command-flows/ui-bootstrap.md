# UI bootstrap

UI bootstrap begins when the renderer bundle is loaded in the main application window created by `src/main/windows.js`.

## High-level UI startup sequence

1. **Electron creates the main window**
    - `src/main/windows.js` creates the `BrowserWindow`
    - the renderer HTML file `dist/index.html` is loaded

2. **Preload bridge is attached**
    - the window uses the preload bundle defined in `src/main/windows.js`
    - `src/main/preload.js` exposes `window.api` through `contextBridge.exposeInMainWorld(...)`

3. **Renderer application mounts**
    - `src/ui/app.js` renders the root React application into `document.getElementById('app')`

4. **Initial UI state is created**
    - `App` starts with:
        - `isApplicationLoading = true`
        - `isImportInProgress = false`
        - `showWelcomeMessage = false`
        - `applicationState = unInitializedApplicationState`

5. **Renderer subscribes to main-process events**
    - `src/ui/app.js` registers listeners using:
        - `window.api.receive(ipcChannels.NOTIFY_RENDERER_PROCESS, notifyRendererHandler)`
        - `window.api.receive(ipcChannels.ZOOM_FACTOR_CHANGE_ACTION, zoomFactorChangeHandler)`

6. **Main-process bootstrap completes asynchronously**
    - after the renderer finishes loading, `src/main/windows.js` calls `bootstrap(win.webContents)`
    - the UI then waits for bootstrap events from the main process

## Initial renderer state

Before bootstrap completes, the application uses `unInitializedApplicationState` from `src/ui/app.js`.

Current default state includes:

- `currentApplicationView: applicationViewStates.COLLECTIONS_VIEW`
- `currentPlaylist: null`
- `hideHiddenCollections: false`
- `appStatus.freezeApp: false`
- `appStatus.message: ''`

This default state is only a placeholder until the main process sends the real initialization payload.

## Main bootstrap events consumed by the UI

The main UI listener in `src/ui/app.js` responds to several bootstrap-related events.

### 1. `mainThreadEvents.ON_LIBRARY_PATH_NOT_FOUND`

When this event is received:

- `isApplicationLoading` stays `true`
- `showWelcomeMessage` becomes `true`

This means:

- the app could not restore a valid library root path
- the main application does not continue into normal library-backed views yet
- the welcome flow is shown to the user

### 2. `mainThreadEvents.ON_SUCCESSFUL_INIT`

When this event is received:

- the payload returned from bootstrap is merged into application state
- the renderer also loads the saved application setting:
    - `window.api.getApplicationSettings('currentApplicationView')`
- `showWelcomeMessage` is set to `false`
- `isApplicationLoading` is set to `false`
- `isImportInProgress` is set to `false`

If `message.payload.importWarning` exists:

- `showGlobalError(...)` displays a warning that some files could not be imported

### 3. `mainThreadEvents.ON_NEW_LIBRARY_SELECTION_COMPLETE`

This follows the same initialization path as `ON_SUCCESSFUL_INIT`, but is used after the user selects a new library folder instead of restoring an existing one.

### 4. `mainThreadEvents.ON_IMPORT_PROGRESS`

When import is still running:

- `importProgressStatus` is updated
- `isImportInProgress` becomes `true`
- `showWelcomeMessage` becomes `false`

This shows a blocking import progress UI while bootstrap-related import work is still ongoing.

### 5. `mainThreadEvents.ON_IMPORT_FAILURE`

When import fails:

- `isImportInProgress` becomes `false`
- `showWelcomeMessage` becomes `false`
- `showGlobalError(...)` displays the import error

This means bootstrap did not complete successfully enough to enter the normal library-backed UI.

## View selection after successful bootstrap

Once initialization succeeds, `ApplicationContext` is created with the merged bootstrap payload.

`ApplicationContent` in `src/ui/app.js` then chooses the active view using `getCurrentView(stateContext)`.

Supported views include:

- `applicationViewStates.SETTINGS_VIEW` -> `Settings`
- `applicationViewStates.PLAYLISTS_DASHBOARD_VIEW` -> `Dashboard`
- `applicationViewStates.COLLECTIONS_VIEW` -> `AllCollections`
- `applicationViewStates.PLAYER_VIEW` -> `Player`

This is the point where the UI transitions from splash/loading mode into the actual application.

## Application-level event subscriptions after bootstrap

`ApplicationContent` also subscribes to ongoing renderer events through `ipcChannels.NOTIFY_RENDERER_PROCESS`.

It reacts to updates such as:

- `mainThreadEvents.ON_PLAYLIST_UPDATE`
- `mainThreadEvents.ON_TAGS_UPDATE`
- `applicationEvents.COLLECTIONS_UPDATE`
- `mainThreadEvents.ON_NEW_LIBRARY_SELECTION_COMPLETE`

These events update the application context after the initial bootstrap has completed.

## Menu-driven UI updates

`ApplicationContent` also listens to:

- `ipcChannels.APPLICATION_MENU_ACTION`

Example from `src/ui/app.js`:

- when `applicationMenuEvents.TOGGLE_HIDDEN_COLLECTIONS` is received
- the renderer reads `hideHiddenCollections` using `window.api.getUserPreference(...)`
- then writes the updated preference with `window.api.setUserPreference(...)`
- then dispatches `applicationEvents.USER_PREFERENCE_UPDATE`

This shows that the UI remains event-driven even after bootstrap.

## Loading and welcome states in the UI

During bootstrap, `App` conditionally renders different temporary UI layers:

- **Loading screen**
    - shown when `isApplicationLoading` is `true`
    - displays `Loading Melvec...`

- **Welcome screen**
    - shown when `showWelcomeMessage` is `true`
    - used when no valid library path is available

- **Import progress screen**
    - shown when `isImportInProgress` is `true`
    - displays progress text from `importProgressStatus`

Only after successful initialization does the main app layout render:

- `AppHeader`
- `ApplicationContent`
- `AppFreezer`
- `AppStatusMessage`

## Summary

UI bootstrap in Melvec follows this flow:

`BrowserWindow` loads renderer  
→ preload exposes `window.api`  
→ `src/ui/app.js` mounts React  
→ UI subscribes to main-process events  
→ main-process bootstrap runs  
→ renderer receives one of:

- library path missing
- import progress
- import failure
- successful init

After a successful init, the renderer builds `ApplicationContext` and switches into the active application view.
