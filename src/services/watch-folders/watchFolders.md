# Watch Folders Service

## Overview

The `watchFolders` service manages the watch folder feature, which allows users to designate external directories for monitoring. Media files (both **videos and images**) found in these directories are scanned, catalogued, and made available for import into the main library. The service handles the full lifecycle of a watch folder: creation, scanning, refresh, validation, and removal. It also responds to inter-service events to stay in sync when media is imported from watched directories.

---

## Location

```
src/services/watch-folders/watchFolders.js
src/services/watch-folders/watchFolders.service.js
```

---

## Architecture

```
IPC Handler / Service Gateway
  → watchFolders.service.js    (UI-facing wrappers, import routing by mediaType)
    → watchFolders.js          (core domain logic, filesystem scanning)
      → watchFoldersDbService.js → SQLite (better-sqlite3)
```

The service also participates in the inter-service event bus:

```
videoLibrary / imageLibrary (IMPORT_FILE_SUCCESS)
  → serviceEventBus → watchFolders.js (onImportFileSuccess)
```

---

## Exported Functions — `watchFolders.service.js`

### `importMediaToCollectionService(arg)`

Imports a media item from a watch folder into a library collection. Routes to either `importVideoFromWatchedDirectory` or `importImageFromWatchedDirectory` based on the item's `mediaType`.

- **Parameters:**
    - `arg` _(object)_ — `{ mediaId, newCollection }`
        - `mediaId` _(string)_ — ID of the watch folder media item to import.
        - `newCollection` _(object)_ — `{ id, label, year }` — destination collection.
- **Returns:** `void` (result is sent via `webContents.send`)
- **Notes:**
    - Looks up media details via `getMediaDetailsByIdFromWatchFolders(mediaId)`.
    - Sends `ipcChannels.IMPORTED_FROM_WATCH_FOLDER_ACTION` to the renderer with `{ status, videoId }` on both success and failure.
    - Returns early (no IPC send) if `mediaId` or `newCollection` is missing.

---

### `removeWatchFolderService(watchFolderId)`

Deletes all thumbnails for a watch folder's media items and then removes the folder and its records.

- **Parameters:**
    - `watchFolderId` _(string)_ — The unique identifier of the watch folder.
- **Returns:** `Promise<Array>` — The updated list of watch folders (raw array, not a `respondSuccess` envelope).
- **Notes:**
    - Calls `deleteThumbnail(mediaFile.id)` for every media item before removing folder records.

---

### `removeMediaFromWatchFolder(args)`

Removes a single media item from a watch folder, optionally deleting the physical file.

- **Parameters:**
    - `args` _(object)_ — `{ mediaId, watchFolderId, initiator, mediaType }`
- **Returns:** `void`
- **Notes:**
    - Delegates to `watchFolders.js#removeWatchFolderMedia`.

---

### `getWatchFoldersService()`

Returns all registered watch folders.

- **Returns:** `object` — A `respondSuccess` envelope containing an array of watch folder records.
- **Notes:**
    - Returns an empty success response if an error occurs, to avoid breaking the UI on load.

---

### `refreshWatchFolderService(watchFolderId)`

Triggers a refresh of a single watch folder and returns a success response when done.

- **Parameters:**
    - `watchFolderId` _(string)_
- **Returns:** `Promise<object>` — `respondSuccess` on completion; `undefined` if the refresh returns falsy.

---

### Re-exported directly from `watchFolders.js` (no wrapper)

- `initWatchFolderService`
- `addWatchFolder`
- `getWatchFolders`
- `getMediaByWatchFolder`

---

## Core Logic — `watchFolders.js`

### `initWatchFolderService()`

Initializes the watch folder database, subscribes to `IMPORT_FILE_SUCCESS`, and schedules a validation pass across all registered watch folders 1 second after startup.

- **Returns:** `void`

---

### `addWatchFolder(watchfolder)`

Registers a new watch folder record (if not already present) and performs an initial media scan.

- **Parameters:**
    - `watchfolder` _(object)_ — `{ id, path, label }`
- **Returns:** `Promise<Array>` — The updated list of all watch folders.
- **Notes:**
    - Guards against duplicate entries via `getWatchFolderById(id)`.
    - Delegates the scan to `scanAndSyncWatchFolderMedia()`.

---

### `removeWatchFolder(id)`

Removes all media records for a watch folder, then removes the folder record itself.

- **Parameters:**
    - `id` _(string)_
- **Returns:** `Promise<Array>` — The updated list of all watch folders, unchanged if the folder was not found.

---

### `getWatchFolders()`

Returns all registered watch folders from the database.

- **Returns:** `Array<object>`

---

### `getMediaByWatchFolder(watchFolderId)`

Returns all media records stored under a given watch folder.

- **Parameters:**
    - `watchFolderId` _(string)_
- **Returns:** `Array<object>` — Array of media records (videos and images).

---

### `getMediaDetailsByIdFromWatchFolders(mediaId)`

Searches all watch folders to find a media item by ID.

- **Parameters:**
    - `mediaId` _(string)_
- **Returns:** `object | null` — The media record including its `watchFolderId`, or `null` if not found.
- **Notes:**
    - Backed by internal `findMediaFromAllWatchFolders(mediaId)`.
    - Iterates every watch folder until a match is found (brute-force).

---

### `removeWatchFolderMedia(mediaId, watchFolderId, initiator, mediaType)`

Removes a media item from a watch folder, optionally deleting the physical file from disk.

- **Parameters:**
    - `mediaId` _(string)_
    - `watchFolderId` _(string)_
    - `initiator` _(string)_ — Pass `'INOENT'` to skip physical file deletion when the file is already missing.
    - `mediaType` _(string)_ — Present for future use; not currently applied to branching logic.
- **Returns:** `void`
- **Notes:**
    - When `initiator !== 'INOENT'`, calls `removeFile(path)` to delete the physical file.
    - DB record is always removed via `removeWatchFolderMediaFromDb(mediaId)`.

---

### `refreshWatchFolder(watchFolderId)`

Validates all existing media records against the filesystem, removes stale entries, and scans for newly added files.

- **Parameters:**
    - `watchFolderId` _(string)_
- **Returns:** `Promise<true | undefined>` — `true` on successful scan; `false` on scan error; `undefined` if the folder record is not found.
- **Notes:**
    - Uses `doesFileExistAsync()` per media item.
    - Calls `deleteThumbnail(mediaItem.id)` then `removeMediaFromWatchFolder` for any missing file.
    - After cleanup, calls `scanAndSyncWatchFolderMedia()` for new files.

---

## Internal Helpers — `watchFolders.js`

### `addMediaMetricsToScannedItem(scannedItemData)` _(not exported)_

Enriches a raw scanned media record with computed metadata: `year`, `id`, `mediaType`, and (for videos) `duration`.

- **Parameters:**
    - `scannedItemData` _(object)_ — Raw record from `scanMediaFiles`.
- **Returns:** `Promise<object>` — The enriched record.
- **Notes:**
    - `mediaType` is determined by `getMediaTypeFromPath(path)` — supports both video and image files.
    - `duration` is only fetched (via `getVideoDuration`) for items where `mediaType === 'video'`; set to `null` for images.
    - `id` is produced by `generateMediaId()` — a potentially slow content-hash operation. Kept in a separate function intentionally to isolate the cost.

---

### `scanAndSyncWatchFolderMedia(watchFolder)` _(not exported)_

Scans the filesystem for supported media files in a watch folder and inserts any newly discovered items into the DB.

- **Parameters:**
    - `watchFolder` _(object)_ — `{ id, path }`
- **Returns:** `Promise<Array>` — The full updated media list for the watch folder.
- **Notes:**
    - Excludes `.DS_Store`, `.melvec`, and the trash-bin directory from scans.
    - Supported extensions come from `systemConfig.SUPPORTED_MEDIA_EXTENSIONS`.
    - Compares scanned paths against existing records — only new paths are processed.
    - Calls `addMediaMetricsToScannedItem()` per new item before bulk-inserting via `addWatchFolderMedia`.

---

### `searchMediaByWatchFolder(watchFolder)` _(not exported)_

Runs `scanMediaFiles` on the watch folder path with standard exclusion rules.

- **Returns:** `Promise<Array>` — Raw scanned media items with `birthtimeMs`, `type`, and `size` attributes.

---

### `findMediaFromAllWatchFolders(mediaId)` _(not exported)_

Brute-force iterates all watch folders to find a media item by ID.

- **Returns:** `object | null` — Media record with `watchFolderId` merged in, or `null`.

---

### `removeMediaFromWatchFolder(watchFolderId, mediaId)` _(not exported)_

Guards against missing folder records, then calls `removeWatchFolderMediaFromDb(mediaId)`.

- **Notes:**
    - Parameter order is `(watchFolderId, mediaId)` — note this is **not** the same order as the exported `removeWatchFolderMedia`.

---

### `validateAllWatchFolders()` _(not exported)_

Iterates all registered watch folders and calls `refreshWatchFolder` for each.

- **Returns:** `void`, or a `'No watch folders found'` string if none are registered.
- Called automatically at startup via a 1-second `setTimeout` in `initWatchFolderService`.

---

### `onImportFileSuccess(data)` _(not exported)_

Handles `IMPORT_FILE_SUCCESS` events. If `data.completedMediaStats.watchFolderId` is present, removes the imported item from its originating watch folder via `removeMediaFromWatchFolder`.

---

## Dependencies

| Module                      | Purpose                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `watchFoldersDbService.js`  | All DB read/write for watch folders and their media records                 |
| `serviceEventBus.js`        | Pub/sub bus for inter-service communication                                 |
| `interServiceEvents.js`     | Event name constants (`IMPORT_FILE_SUCCESS`)                                |
| `fileUtils.js`              | `removeFile()`, `doesFileExistAsync()`                                      |
| `scanMediaFiles.js`         | Filesystem scan returning media file records                                |
| `getMediaTypeFromPath.js`   | Determines `'video'` or `'image'` from a file path                          |
| `getVideoDuration.js`       | Extracts video duration via `ffprobe` (videos only)                         |
| `generateMediaId.js`        | Content-hash based stable ID generation                                     |
| `timeUtils.js`              | `getFileYear()` from file `birthtimeMs`                                     |
| `systemConfig.js`           | `SUPPORTED_MEDIA_EXTENSIONS`, `TRASHBIN_DIR`                                |
| `thumbnail.js`              | `deleteThumbnail()` for stale/removed media                                 |
| `videoLibrary.js`           | `importVideoFromWatchedDirectory`                                           |
| `imageLibrary.js`           | `importImageFromWatchedDirectory`                                           |
| `ipcChannels.js`            | `IMPORTED_FROM_WATCH_FOLDER_ACTION` channel constant                        |
| `mediaTypes.js`             | `VIDEO` / `IMAGE` type constants                                            |
| `service-utils/sendToUI.js` | `respondSuccess` for `getWatchFoldersService` / `refreshWatchFolderService` |

---

## Related Services

| Service           | Relationship                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| `videoLibrary.js` | Called to physically import videos from watch folders into the main library |
| `imageLibrary.js` | Called to physically import images from watch folders into the main library |
| `thumbnail.js`    | Called during folder removal and refresh to clean up stale thumbnails       |
| `search`          | May index watch folder media once promoted to the main library              |

---

## Data Flow

### Adding a Watch Folder

```
addWatchFolder
  → addWatchFolderToDb (DB)
  → scanAndSyncWatchFolderMedia
    → searchMediaByWatchFolder (fs scan)
    → addMediaMetricsToScannedItem (per new item: id, year, mediaType, duration)
    → addWatchFolderMedia (DB bulk insert)
```

### Importing Media to Library

```
importMediaToCollectionService({ mediaId, newCollection })
  → getMediaDetailsByIdFromWatchFolders (find item)
  → importVideoFromWatchedDirectory  (if mediaType === 'video')
  → importImageFromWatchedDirectory  (if mediaType === 'image')
  → webContents.send(IMPORTED_FROM_WATCH_FOLDER_ACTION, { status, videoId })
```

### Refreshing a Watch Folder

```
refreshWatchFolder
  → doesFileExistAsync (per media item)
  → deleteThumbnail + removeMediaFromWatchFolder (stale entries)
  → scanAndSyncWatchFolderMedia (new entries)
```

### Import Success Event (auto-cleanup)

```
IMPORT_FILE_SUCCESS (serviceEventBus)
  → onImportFileSuccess
  → removeMediaFromWatchFolder (removes item from watch folder DB)
```

### Startup Validation

```
initWatchFolderService
  → setTimeout 1s
  → validateAllWatchFolders
  → refreshWatchFolder (per folder)
```
