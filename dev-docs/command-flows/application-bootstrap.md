# Application bootstrap

Application bootstrap begins in `src/main/main.js` when Electron reaches `app.whenReady()`.

## High-level startup sequence

1. **Initialize system logging**
    - `src/main/main.js` calls `initSystemLogService(app.getPath('userData'))`
    - This ensures startup and runtime errors can be recorded before any library is selected

2. **Create the main window**
    - `src/main/main.js` calls `createWindow(...)` from `src/main/windows.js`
    - The main `BrowserWindow` is created with:
        - `contextIsolation: true`
        - `nodeIntegration: false`
        - `sandbox: true`
        - preload bundle from `dist/preload.bundle.js`

3. **Load the renderer**
    - `src/main/windows.js` loads `dist/index.html`
    - In development mode, DevTools are opened automatically

4. **Inject system theme**
    - On `dom-ready`, `src/main/windows.js` calls `injectSystemTheme(win.webContents)`

5. **Trigger bootstrap after renderer load**
    - On `did-finish-load`, `src/main/windows.js` stores `win.webContents`
    - It then calls `bootstrap(win.webContents)` from `src/main/bootstrap.js`

6. **Register application-level handlers**
    - `src/main/main.js` registers:
        - application menu via `setApplicationMenu(...)`
        - download handlers via `registerDownloadsHandlers(...)`
        - IPC handlers via `registerIpcHandlers(...)`
        - dev shortcut `F12` for toggling DevTools

## Bootstrap flow inside `src/main/bootstrap.js`

The main initialization logic runs inside `bootstrap(webContents)`.

### Step 1: Validate system configuration

`validateSystemConfiguration()` runs first.

**Current behavior:**

- checks whether the app is running on an Intel Mac
- sets `userPreferenceStore.set('isAISupported', !isIntelMac)`
- this means AI support is disabled on Intel macOS systems during bootstrap

### Step 2: Read stored library root path

`bootstrap(webContents)` reads:

- `userPreferenceStore.get('libraryRootPath')`

This saved path determines whether the application can restore an existing library automatically.

### Step 3: Apply development-only setup

If `isDev` is enabled in `src/services/service-utils/env`, bootstrap may run development helpers from `src/configs/devConfig`:

- `createInitialTestBed()`
- `resetTagsData(libraryRootPath)`

These are only used for development/test-bed initialization.

### Step 4: Validate the stored library path

`bootstrap(webContents)` checks the saved path using:

- `doesFileExist(libraryRootPath)`

**If the path does not exist:**

- it emits `mainThreadEvents.ON_LIBRARY_PATH_NOT_FOUND`
- bootstrap stops at this point
- the UI is expected to react by asking the user to choose a library folder

### Step 5: Initialize the library

If the library path exists, `bootstrap(webContents)` calls:

```js
initializeLibrary({ libraryRootPath, webContents, isNewSelection: false });
```

This is the main library bootstrap stage.

## Library initialization flow

`initializeLibrary(...)` in `src/main/bootstrap.js` performs the following stages:

1. **Persist selected library root when needed**
    - If this is a newly selected folder, it stores the path in `userPreferenceStore`

2. **Initialize core services**
    - Calls `serviceGateway.init({ libraryRootPath, userPreferenceStore })`

3. **Validate and import pending media data**
    - Calls `validateLibraryData(libraryRootPath, webContents)`

4. **Handle import result**
    - If import fails, emits `mainThreadEvents.ON_IMPORT_FAILURE`
    - bootstrap stops without initializing secondary services

5. **Initialize secondary services**
    - Calls `serviceGateway.initSecondaryServices()`

6. **Persist derived library path**
    - Stores `servicePathConfig.getLibDir()` as `libraryPath`

7. **Persist recently used library path**
    - For new library selections, calls `saveLastUsedLibraryPath(libraryRootPath)`

8. **Emit success event to UI**
    - Emits one of:
        - `mainThreadEvents.ON_SUCCESSFUL_INIT`
        - `mainThreadEvents.ON_NEW_LIBRARY_SELECTION_COMPLETE`
    - The emitted payload is built from:
        - `serviceGateway.getInitialLibraryState()`
        - optional import warning when media import is partially successful

## Pending media import validation

`validateLibraryData(...)` handles any media files waiting to be imported.

**Flow:**

1. `scanMediaFilesToImport()` checks for pending files
2. **If no files exist:**
    - Returns `COMPLETE`
3. **If files exist:**
    - `importMedia(filesToImport, servicePathConfig.getLibDir(), webContents)` runs
    - `cleanupImportSourceFolders()` runs afterward
4. **Final status returned:**
    - `complete`
    - `partial_complete`
    - `import_error`

This result controls whether full bootstrap can continue.

## When no library path exists or is invalid

If the saved library root path is missing or invalid, bootstrap emits:

- `mainThreadEvents.ON_LIBRARY_PATH_NOT_FOUND`

At that point, the application does not fully initialize library services.

The expected next step is user-driven folder selection through the open-folder flow handled by:

- `src/main/registerIpcHandlers.js`
- `src/main/bootstrap.js`
- `openAndSelectLibraryPath(webContents)`
- `onNewLibraryFolderSelection(path, webContents)`

## Role of preload during bootstrap

`src/main/preload.js` exposes `window.api` using `contextBridge.exposeInMainWorld(...)`.

This does not perform bootstrap itself, but it establishes the safe renderer-to-main bridge that the UI uses after the window loads.

## Main-process registration during startup

In parallel with bootstrap, `src/main/main.js` also prepares supporting application infrastructure:

- `registerIpcHandlers(...)` from `src/main/registerIpcHandlers.js`
- `registerDownloadsHandlers(...)`
- application menu setup via `setApplicationMenu(...)`
- help window support via `createHelpWindow(...)`

These ensure the app can respond to renderer requests once bootstrap completes.

## Shutdown-related bootstrap companion flow

`src/main/main.js` also wires shutdown behavior:

- `before-quit` calls `beforeAppQuit()` from `src/main/bootstrap.js`
- `beforeAppQuit()` calls `requestForApplicationClosing()`
- `will-quit` unregisters all global shortcuts

This makes bootstrap and shutdown part of the same lifecycle boundary managed from the main process.

## Summary

**Application bootstrap in Melvec follows this sequence:**

```text
app.whenReady()
  → initSystemLogService(...)
  → createWindow(...)
  → renderer loads
  → bootstrap(webContents)
  → validate system config
  → restore and validate library path
  → initialize core services
  → import/validate library data
  → initialize secondary services
  → emit ready state to UI
```
