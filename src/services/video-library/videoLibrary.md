# Video Library Service

## Overview

The video library module is split into two files:

- **`videoLibrary.js`** — core domain logic: importing, moving, deleting, renaming, and updating video records. Interfaces directly with `videoLibraryDbService` and the filesystem.
- **`videoLibrary.service.js`** — UI-facing service wrapper: hydrates raw DB records into UI-ready shapes, wraps mutations with `respondSuccess`/`respondError` responses, and publishes inter-service events.

Both files are consumed by IPC handlers via the service gateway layer.

---

## Location

```
src/services/video-library/videoLibrary.js
src/services/video-library/videoLibrary.service.js
```

---

## Architecture

```
IPC Handler / Service Gateway
  → videoLibrary.service.js   (UI response shaping, event publishing)
    → videoLibrary.js         (domain logic, filesystem operations)
      → videoLibraryDbService.js → SQLite (better-sqlite3)
```

---

## `videoLibrary.js` — Exported Functions

### `initVideoLibraryService()`

Initializes the video library database and subscribes to the `IMPORT_FILE_SUCCESS` inter-service event to handle file imports triggered by other parts of the system (e.g. watch folders).

- **Returns:** `void`
- **Usage:** Called once during application bootstrap.

---

### `getVideoDetailsById(id)`

Retrieves the raw DB record for a single video by its unique ID. Re-exported directly from `videoLibraryDbService`.

- **Parameters:**
    - `id` _(string)_ — The unique identifier of the video.
- **Returns:** `object | null`

---

### `getAllVideos()`

Returns all video records currently stored in the library.

- **Returns:** `Array<object>`

---

### `getAllVideoIds()`

Returns the IDs of all videos in the library.

- **Returns:** `Array<string>`

---

### `checkForDuplicate(videoId)`

Checks whether a video with the given ID already exists in the library.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video.
- **Returns:** `boolean` — `true` if a record already exists.

---

### `importVideoFromWatchedDirectory(videoDetails, destinationCollection)`

Physically moves a video file from a watch folder into the library directory, then publishes an `IMPORT_FILE_SUCCESS` event (which `initVideoLibraryService` subscribes to in order to insert the DB record).

- **Parameters:**
    - `videoDetails` _(object)_ — `{ id, name, birthtimeMs, path, size, duration, watchFolderId }`
    - `destinationCollection` _(object)_ — `{ id, label, year }`
- **Returns:** `Promise<{ status: 'success', data: { videoDetails } }>` on success; rejects with `{ status: 'error', data: { videoDetails, error } }` on failure.
- **Events published:**
    - `interServiceEvents.IMPORT_FILE_SUCCESS` — on successful file move
    - `interServiceEvents.IMPORT_FILE_FAILURE` — on filesystem error
- **Throws:** `Error` if `videoDetails.id` or `destinationCollection.id` is missing.

---

### `deleteVideoDetails(videoId, initiator)`

Deletes a video's DB record and moves the physical file to the trash bin directory.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video.
    - `initiator` _(string)_ — Source of the deletion (e.g. `'user'`, `'ENOENT'`).
- **Returns:** `Promise<false>` — always resolves `false` (callers should rely on side-effects).
- **Notes:**
    - The physical file is moved to the path returned by `getTrashBinPath()`, not permanently deleted.
    - DB record is removed first; file move is attempted asynchronously.

---

### `moveVideo(videoId, newCollection)`

Physically moves a video file to a new collection folder and updates the DB record with the new path and `collection_id`. Publishes a `VIDEO_COLLECTION_CHANGE` event.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video.
    - `newCollection` _(object)_ — `{ id, label, year }` — the destination collection.
- **Returns:** `Promise<void>`
- **Events published:**
    - `interServiceEvents.VIDEO_COLLECTION_CHANGE` — `{ newCollectionId, oldCollectionId }`

---

### `udpateVideoTitle(id, title)`

Updates the title field of a video record.

- **Parameters:**
    - `id` _(string)_ — The unique identifier of the video.
    - `title` _(string)_ — The new title to apply.
- **Returns:** Result of `updateVideoDetails(...)`, or `null` if `id` is empty or record not found.
- **Notes:**
    - The function name contains a known typo (`udpate`). Do not rename without updating all callers.

---

### `renameVideoFile(videoId, oldFileName, newFileName)`

Physically renames a video file on disk (prefixing it with `_${videoId}_` to ensure uniqueness) and updates the `name` and `path` fields in the DB.

- **Parameters:**
    - `videoId` _(string)_
    - `oldFileName` _(string)_ — The current filename (used as a guard check).
    - `newFileName` _(string)_ — The desired new filename (without directory).
- **Returns:** `Promise<{ status: 'success', message: string }>` on success; `Promise<false>` on failure or missing parameters.
- **Notes:**
    - The stored path uses the prefixed filename (`_${videoId}_${newFileName}`), while `name` is stored without the prefix.

---

### `updateNsfwStatus(id, isNsfw)`

Sets or clears the NSFW flag for a video.

- **Parameters:**
    - `id` _(string)_
    - `isNsfw` _(boolean)_ — stored as `1` / `0` in the DB.
- **Returns:** Result of `updateVideoDetails(...)`, or `null` if `id` is empty.

---

## `videoLibrary.js` — Internal Helpers

### `getRelativeFolderPath(videoPath)` _(not exported)_

Strips the filename from a relative video path, returning the folder portion.

### `getVideoFullPath(videoPath)` _(not exported)_

Joins the library root directory (`getLibDir()`) with a relative video path to produce an absolute filesystem path.

### `updateVideoDetailsById(id, updateDetails)` _(not exported)_

Fetches the current video record by ID, merges `updateDetails`, and persists via `updateVideoDetails`. No-op if `id` is empty or the record does not exist.

### `onImportFileSuccess(data)` _(not exported)_

Handles `IMPORT_FILE_SUCCESS` events. Guards against non-video media types, ensures the collection exists (creating it if not), then inserts the video if no duplicate is found.

---

## `videoLibrary.service.js` — Exported Functions

### `getFullVideoDetailsById(videoId)`

Returns a fully hydrated video object enriched with metrics, playlists, and tags — the primary shape consumed by the UI.

- **Returns:** `object | null`
- **Shape includes:** all basic fields (see below) plus `views`, `quality`, `rating`, `playlists`, `tags`

---

### `getBasicVideoDetailsById(videoId)`

Maps a raw DB video record to a clean UI-facing shape. Resolves `isHidden` from the current hidden-collection set.

- **Returns:** `object | null`
- **Shape:**

```js
{
  thumbnailURL,   // absolute path to <videoId>.jpg in thumbnails dir
  id,
  name,           // filename
  collection,     // collection label
  collectionId,
  path,           // relative path
  size,
  duration,
  birthtimeMs,
  title,
  isHidden,       // true if collection is in the hidden set
  isNsfw,
  source,
  categoryId,
}
```

---

### `removeVideoFromLibrary(videoIds, initiator)`

Deletes one or more videos. For each ID publishes `DELETE_VIDEO`, then (unless `initiator === 'ENOENT'`) calls `deleteVideoDetails` and on success publishes `INDEX_DATA_CHANGED` with `change: 'videoRemoved'`.

- **Parameters:**
    - `videoIds` _(string[])_ — Array of video IDs to remove.
    - `initiator` _(string)_ — `'ENOENT'` skips the physical delete (file already gone).
- **Events published:**
    - `interServiceEvents.DELETE_VIDEO`
    - `interServiceEvents.INDEX_DATA_CHANGED` — `{ change: 'videoRemoved', videoId }`

---

### `updateVideoTitleService(videoId, title)`

Calls `udpateVideoTitle`, then publishes `INDEX_DATA_CHANGED` with `change: 'titleChange'`.

- **Returns:** `respondSuccess` | `respondError`
- **Events published:** `interServiceEvents.INDEX_DATA_CHANGED` — `{ change: 'titleChange', videoId }`

---

### `updateNsfwStatusService(videoId, isNsfw)`

Calls `updateNsfwStatus` and wraps the result.

- **Returns:** `respondSuccess` | `respondError`

---

### `updateVideoSourceService(videoId, source)`

Calls `videoLibraryDbService.updateSource` directly.

- **Returns:** `respondSuccess` | `respondFailure` | `respondError`

---

### `updateVideoCategoryService(videoId, categoryId)`

Calls `videoLibraryDbService.updateCategory` and on success publishes `INDEX_DATA_CHANGED` with `change: 'videoCategoryChange'`.

- **Returns:** `respondSuccess` | `respondFailure` | `respondError`
- **Events published:** `interServiceEvents.INDEX_DATA_CHANGED` — `{ change: 'videoCategoryChange', videoId }`

---

### `renameVideoFile` / `getAllVideos` / `moveVideo` / `checkForDuplicate` / `initVideoLibraryService`

Re-exported directly from `videoLibrary.js` without modification.

---

## Dependencies

| Module                    | Purpose                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `videoLibraryDbService`   | All read/write operations against the SQLite video library table                    |
| `collectionsDbService`    | Creates missing collections during import (`addCollection`, `doesCollectionExists`) |
| `servicePathConfig`       | `getLibDir()`, `getTrashBinPath()`                                                  |
| `service-utils/videoPath` | `getRelativeMediaPath`, `getAbsoluteMediaPath`                                      |
| `service-utils/fileUtils` | `removeFile` — moves files to trash bin                                             |
| `fs-extra`                | `fse.move` for all physical file operations                                         |
| `serviceEventBus`         | Inter-service event pub/sub                                                         |
| `interServiceEvents`      | Event name constants                                                                |
| `collections`             | `getHiddenCollectionIds()` for `isHidden` resolution                                |
| `videoMetrics`            | `getVideoMetricsByVideoId` used in full hydration                                   |
| `playlists`               | `getPlaylistsByVideoId` used in full hydration                                      |
| `tags`                    | `getTagsByVideoId` used in full hydration                                           |

---

## Events Published

| Event                     | Publisher                                                                         | Payload                                       |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| `IMPORT_FILE_SUCCESS`     | `importVideoFromWatchedDirectory`                                                 | `{ completedMediaStats, mediaType: 'video' }` |
| `IMPORT_FILE_FAILURE`     | `importVideoFromWatchedDirectory`                                                 | `{ videoDetails, message, error }`            |
| `VIDEO_COLLECTION_CHANGE` | `moveVideo`                                                                       | `{ newCollectionId, oldCollectionId }`        |
| `DELETE_VIDEO`            | `removeVideoFromLibrary`                                                          | `{ videoId }`                                 |
| `INDEX_DATA_CHANGED`      | `removeVideoFromLibrary`, `updateVideoTitleService`, `updateVideoCategoryService` | `{ change, videoId }`                         |

---

## Related Services

| Service                         | Relationship                                                   |
| ------------------------------- | -------------------------------------------------------------- |
| `videoMetaData.service.js`      | Calls `udpateVideoTitle` when applying AI-generated titles     |
| `batchGenerateVideoMetaData.js` | Calls `udpateVideoTitle` during batch metadata generation      |
| `watch-folders`                 | Triggers `importVideoFromWatchedDirectory` during folder scans |
| `import-export`                 | Uses video details for export operations                       |
