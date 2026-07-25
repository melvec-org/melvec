# Collections Service

## Overview

The Collections Service (`collections.service.js`) acts as the **orchestration layer** between the IPC gateway and the core collections business logic. It handles collection CRUD operations, video-to-collection assignments, and coordinates side effects such as file system changes and search index updates.

---

## Architecture Position

```text
serviceGateway.js
      │
      ▼
collections.service.js                       ← You are here
      │
      ├──► collections.js                    (core business logic)
      │         │
      │         └──► collectionsDbService.js (DB layer)
      │
      ├──► videolibrary.service.js           (video details + move)
      ├──► watchFolders.service.js           (external collection videos)
      ├──► serviceEventBus                   (index/cache invalidation)
      └──► servicePathConfig                 (thumbnail directory)
```

## Exported Functions

### `initCollectionsService()`

Bootstraps the collections service on application startup. Called once during app initialization via `serviceGateway.js`.

**Behavior (delegated to `collections.js`):**

- Initializes the SQLite database connection via `initializeDb()`.
- Subscribes to the following `serviceEventBus` events:

| Event Consumed            | Effect                                                          |
| ------------------------- | --------------------------------------------------------------- |
| `IMPORT_FILE_SUCCESS`     | Clears the collection cache for the imported video's collection |
| `DELETE_VIDEO`            | Clears the collection cache for the deleted video's collection  |
| `VIDEO_COLLECTION_CHANGE` | Clears cache for both the old and new collection IDs            |

**Returns:** `void`

---

### `getCollectionDetailsService(collectionId, isExternalCollection)`

Fetches the list of video items belonging to a collection. Supports both **internal** (DB-managed) and **external** (watch folder) collections.

**Parameters:**

| Name                   | Type      | Default | Description                               |
| ---------------------- | --------- | ------- | ----------------------------------------- |
| `collectionId`         | `string`  | —       | ID of the collection or watch folder      |
| `isExternalCollection` | `boolean` | `false` | Whether this is a watch folder collection |

**Behavior — Internal Collection:**

- Calls `getVideosByCollection(collectionId)` to retrieve an array of video IDs.
- Maps each ID through `getBasicVideoDetailsById()` to produce enriched video detail objects.
- Filters out any `null` results (e.g. deleted or missing videos).

**Behavior — External (Watch Folder) Collection:**

- Calls `getMediaByWatchFolder(collectionId)` to get raw watch folder video entries.
- Manually constructs a normalized video detail object for each entry:

| Field                                                           | Source                                             |
| --------------------------------------------------------------- | -------------------------------------------------- |
| `name`, `id`, `size`, `duration`, `birthtimeMs`, `path`, `year` | Raw watch folder data                              |
| `collection`                                                    | `video.coll`                                       |
| `isExternal`                                                    | Hard-coded `true`                                  |
| `isDuplicate`                                                   | `checkForDuplicate(video.id)`                      |
| `thumbnailURL`                                                  | `path.join(getThumbnailsDir(), video.id + '.jpg')` |

- Filters out `null` results.

**Returns:** `Array<VideoDetailObject>` or `[]`

---

### `addNewCollectionService(year, label, isHidden)`

Creates a new collection entry.

**Parameters:**

| Name       | Type      | Description                                        |
| ---------- | --------- | -------------------------------------------------- |
| `year`     | `string`  | Year grouping for the collection                   |
| `label`    | `string`  | Display name for the collection                    |
| `isHidden` | `boolean` | Whether to create the collection in a hidden state |

**Validation:**

- Returns an error response if `year` or `label` are falsy, or if `isHidden` is not a boolean.

**Behavior:**

- Delegates creation to `addNewCollection(year, label, isHidden)` in `collections.js`.
- On success, fetches the updated full collection list via `getCollectionsList()`.
- Uses the `respond()` utility to build a standardized response envelope.

**Returns:**

On success:

```json
{
    "status": "success",
    "message": "New collection \"<label>\" created",
    "data": ["...collections"]
}
```

On failure:

```json
{
    "status": "error",
    "message": "Invalid inputs"
}
```

---

### `renameCollectionService(collectionId, newName)`

Renames an existing collection and updates the underlying directory on disk.

**Parameters:**

| Name           | Type     | Description                    |
| -------------- | -------- | ------------------------------ |
| `collectionId` | `string` | ID of the collection to rename |
| `newName`      | `string` | The new label/name             |

**Validation:**

- Returns an error response if either `collectionId` or `newName` is falsy.

**Behavior:**

- Calls the **async** `renameCollection(collectionId, newName)` in `collections.js`, which internally:
    - Resolves the old and new filesystem paths via `getLibDir()`.
    - Renames the directory on disk via `renameDirectory()`.
    - Updates the collection label in the database via `renameCollectionLabel()`.
    - Publishes `INDEX_DATA_CHANGED` to trigger search re-indexing.
- After the rename, fetches and returns the updated collection list.

**Returns:**

On success:

```json
{
    "status": "success",
    "data": ["...collections"],
    "message": "Collection <id> renamed to <name>"
}
```

On failure:

```json
{
    "status": "error",
    "message": "<error details>"
}
```

---

### `removeCollectionService(collectionId)`

Removes a collection and cleans up all associated data.

**Parameters:**

| Name           | Type     | Description                    |
| -------------- | -------- | ------------------------------ |
| `collectionId` | `string` | ID of the collection to remove |

**Behavior:**

- Retrieves all video IDs associated with the collection via `getCollectionDetailsById(collectionId).videoIds`.
- Iterates through each video and calls `deleteVideoDetails(videoId)` to purge video records.
- Calls `removeCollection(collectionId)`, which also removes any resulting empty directories on disk.
- On successful removal, publishes `INDEX_DATA_CHANGED` with `{ change: 'collectionRemoved' }` to trigger search re-indexing.
- Returns the updated full collection list.

**Returns:**

On success:

```json
{
    "status": "success",
    "data": ["...collections"],
    "message": "Collection <id> removed successfully"
}
```

On failure:

```json
{
    "status": "error",
    "message": "<error details>"
}
```

---

### `hideCollectionService(collectionId)`

Marks a collection as hidden without deleting it.

**Parameters:**

| Name           | Type     | Description                  |
| -------------- | -------- | ---------------------------- |
| `collectionId` | `string` | ID of the collection to hide |

**Behavior:**

- Validates that `collectionId` is present.
- Calls `hideCollection(collectionId)` from `collections.js`, which delegates to `collectionsDbService`.
- Returns the updated full collection list on success.

**Returns:**

On success:

```json
{
    "status": "success",
    "data": ["...collections"],
    "message": "Collection <id> hidden successfully"
}
```

On failure:

```json
{
    "status": "error",
    "message": "Invalid collectionId"
}
```

---

### `unhideCollectionService(collectionId)`

Restores a previously hidden collection back to a visible state.

**Parameters:**

| Name           | Type     | Description                    |
| -------------- | -------- | ------------------------------ |
| `collectionId` | `string` | ID of the collection to unhide |

**Behavior:**

- Validates that `collectionId` is present.
- Calls `unhideCollection(collectionId)` from `collections.js`.
- Returns the updated full collection list on success.

**Returns:**

On success:

```json
{
    "status": "success",
    "data": ["...collections"],
    "message": "Collection <id> unhidden successfully"
}
```

On failure:

```json
{
    "status": "error",
    "message": "Invalid collectionId"
}
```

---

### `moveVideoFromOneCollectionToAnother(arg)`

Moves a video from its current collection to a new one.

**Parameters:**

| Name                | Type     | Description                      |
| ------------------- | -------- | -------------------------------- |
| `arg.videoId`       | `string` | ID of the video to move          |
| `arg.newCollection` | `string` | ID of the destination collection |

**Behavior:**

- Calls `moveVideo(videoId, newCollection)` from `videolibrary.service.js` to handle the physical file move and DB update.
- Publishes `INDEX_DATA_CHANGED` with `{ change: 'videoCollectionChange' }` to trigger search re-indexing.
- Silently no-ops if either `videoId` or `newCollection` is missing.

**Returns:** `void`

---

## Side Effects and Events

### Events Published

| Event                | Trigger                                   | Payload                                                        |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `INDEX_DATA_CHANGED` | Video moved between collections           | `{ change: 'videoCollectionChange' }`                          |
| `INDEX_DATA_CHANGED` | Collection removed                        | `{ change: 'collectionRemoved' }`                              |
| `INDEX_DATA_CHANGED` | Collection renamed (via `collections.js`) | `{ change: indexingEvents.COLLECTION_UPDATE, collection: id }` |

### Events Consumed

| Event                     | Handler                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `IMPORT_FILE_SUCCESS`     | Clears collection cache for the imported video's collection |
| `DELETE_VIDEO`            | Clears collection cache for the deleted video's collection  |
| `VIDEO_COLLECTION_CHANGE` | Clears cache for both old and new collection IDs            |

---

## Known Issues

| #   | Function                  | Issue                                                                                                                                                                                                                            |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `renameCollectionService` | Validation uses `&&` instead of `\|\|` in earlier versions — only catches the case where both fields are falsy; fixed in current implementation to use `!collectionId \|\| !newName`                                             |
| 2   | `removeCollectionService` | `getCollectionDetailsById` returns a collection record whose shape must include `videoIds`; if that field is absent or the DB schema changes, the `.videoIds` access will silently produce an empty array and skip video cleanup |

---

## Dependencies

| Module                                  | Purpose                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `./collections`                         | Core business logic: CRUD operations, collection listing, cache invalidation |
| `../database/collectionsDbService`      | `getCollectionDetailsById` for retrieving video IDs before removal           |
| `../video-library/videolibrary.service` | `getBasicVideoDetailsById`, `moveVideo`, `checkForDuplicate`                 |
| `../video-library/videoLibrary`         | `deleteVideoDetails` for purging video records during collection removal     |
| `../watch-folders/watchFolders.service` | `getMediaByWatchFolder` for external watch folder collections                |
| `../servicePathConfig`                  | `getThumbnailsDir` for resolving thumbnail file paths                        |
| `../service-utils/serviceEventBus`      | Publishing and consuming domain events                                       |
| `../../events/interServiceEvents`       | Shared event name constants                                                  |
| `../service-utils/sendToUI`             | `respond()` utility for standardized response envelopes                      |
| `path`                                  | Node.js path resolution for thumbnail URLs                                   |
