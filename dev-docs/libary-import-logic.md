# Library import logic

This document describes the current media import, timestamp, collection, and path rules used by the library.

## Relevant source files

- `src/services/bootstrap-services/importMedia.js`
    - `importMedia(mediaList, libraryPath)`
    - `importMediaToLibrary(mediaStats, targetLibrary)`
    - `enrichMediaStatsWithContentCreationTime(mediaStats)`
    - `importVideoToLibrary(mediaStats, targetLibrary)`
    - `importImageToLibrary(mediaStats, targetLibrary)`
    - `importAudioToLibrary(mediaStats, targetLibrary)`
- `src/services/watch-folders/watchFolders.js`
    - `addMediaMetricsToScannedItem(scannedItemData)`
- `src/services/service-utils/getContentCreationTime.js`
    - `getContentCreationTime(path, mediaType)`
    - `getVideoCreationTime(filePath)`
- `src/services/service-utils/timeUtils.js`
    - `isValidMediaTimestamp(timeInMS)`
    - `getPreferredMediaTimestamp(...timestamps)`
    - `getYearFromTime(timeInMS)`
    - `getFileYear(birthtimeMs)`
- `src/services/service-utils/createCollectionName.js`
    - `createCollectionName(relativePath)`
    - `trimCollectionNameWithSameYear(collectionName, year)`
- `src/services/service-utils/mediaPath.js`
    - `getRelativeMediaPath(year, collecionName, filename, id)`
    - `getAbsoluteMediaPath(relativePath)`
- `src/services/collections/collectionsDbService.js`
    - `createDefaultCollection()`
    - `addCollection(id, label, year, isHidden)`
    - `getCollectionByYearAndLabel(year, label)`
- `src/configs/systemConfig.js`
    - `DEFAULT_COLLECTION_NAME`
    - `DEFAULT_COLLECTION_YEAR`
    - `DEFAULT_COLLECTION_ID`

## Import flow overview

The selected-library import flow starts in `src/services/bootstrap-services/importMedia.js`.

1. `importMedia(mediaList, libraryPath)` loops over discovered media items.
2. `importMediaToLibrary(mediaStats, targetLibrary)` enriches each item with the best available timestamp.
3. The media type-specific import function calculates the media ID, year, collection name, relative path, collection ID, and DB payload.
4. The file is moved into the target library.
5. On success, `importMedia()` publishes `interServiceEvents.IMPORT_FILE_SUCCESS`.
6. The matching media library service persists the media row and creates the collection row when needed.

Watch-folder import follows the same timestamp/year rules through `addMediaMetricsToScannedItem(scannedItemData)` in `src/services/watch-folders/watchFolders.js`.

## Timestamp selection

Every imported media file gets one canonical timestamp stored as `birthtimeMs`.

Timestamp priority:

1. Embedded content creation time.
    - Video: ffprobe `format_tags=creation_time` through `getContentCreationTime(path, mediaType)`.
    - Image: EXIF `DateTimeOriginal` through `getContentCreationTime(path, mediaType)`.
    - Audio: embedded creation-time extraction is not currently implemented, so audio normally falls through to filesystem `birthtimeMs`.
2. Filesystem/scanner `birthtimeMs`.
    - Supplied by `scanMediaFiles()` through `attributes: ['birthtimeMs', 'type', 'size']`.
3. No valid timestamp.
    - Stored as `null` by timestamp selection and mapped to `DEFAULT_COLLECTION_YEAR` during year calculation.

`getPreferredMediaTimestamp(...timestamps)` in `src/services/service-utils/timeUtils.js` implements this priority order. It picks the first valid timestamp and skips invalid/future candidates.

A valid media timestamp must be:

- numeric and finite
- greater than zero
- parseable by `Date`
- not in the future

Future timestamps are treated as invalid. This prevents corrupted metadata, bad device clocks, and timestamp unit mistakes from creating future-year folders.

## Year selection

Year calculation is centralized in `src/services/service-utils/timeUtils.js`.

- `getYearFromTime(timeInMS)` returns the timestamp year when the timestamp is valid.
- `getYearFromTime(timeInMS)` returns `systemConfig.DEFAULT_COLLECTION_YEAR` when the timestamp is missing, invalid, zero/negative, non-finite, or future-dated.
- `getFileYear(birthtimeMs)` delegates to `getYearFromTime(birthtimeMs)`.

`src/configs/systemConfig.js` defines:

- `DEFAULT_COLLECTION_YEAR: 10000`

So unknown-date media is assigned to year `10000`.

## Collection selection

Collection selection depends on the resolved timestamp/year and whether the source path contains a meaningful folder.

| Case | Timestamp | Source path/folder | Collection | Year | Example path |
| --- | --- | --- | --- | --- | --- |
| Organized media with embedded creation time | valid | meaningful folder | folder-derived collection | content year | `2026/Vacation/_<id>_video.mp4` |
| Organized media without embedded creation time | valid filesystem `birthtimeMs` | meaningful folder | folder-derived collection | birthtime year | `2026/Vacation/_<id>_video.mp4` |
| Stranded media with embedded creation time | valid | no meaningful folder | `Unfiltered Collection` | content year | `2026/Unfiltered Collection/_<id>_video.mp4` |
| Stranded media without embedded creation time | valid filesystem `birthtimeMs` | no meaningful folder | `Unfiltered Collection` | birthtime year | `2026/Unfiltered Collection/_<id>_video.mp4` |
| Any media with missing/invalid/future timestamp | invalid | any | `Default collection` | `10000` | `10000/Default collection/_<id>_video.mp4` |

## Collection names

### Folder-derived collections

`createCollectionName(relativePath)` in `src/services/service-utils/createCollectionName.js` derives a collection name from the source folder path.

The import functions then call `trimCollectionNameWithSameYear(collectionName, collectionYear)` so paths such as `2026/Vacation/video.mp4` do not duplicate the year in the collection name.

### `Unfiltered Collection`

`Unfiltered Collection` is the per-year fallback for media with a valid timestamp but no meaningful source folder.

`createCollectionName(relativePath)` returns `Unfiltered Collection` when:

- the file is directly under the scanned/imported root, such as `video.mp4`
- all parent folders are junk/generic folders, such as `DCIM/100APPLE`
- folder cleanup leaves no meaningful collection name

Examples:

- `2026/Unfiltered Collection/_<id>_video.mp4`
- `2024/Unfiltered Collection/_<id>_image.jpg`

### `Default collection`

`Default collection` is the system collection for unknown-date media.

- Label: `Default collection`
- ID: `00000000`
- Year: `10000`
- Path: `10000/Default collection/_<id>_<filename>`

Source constants live in `src/configs/systemConfig.js`:

- `DEFAULT_COLLECTION_NAME`
- `DEFAULT_COLLECTION_ID`
- `DEFAULT_COLLECTION_YEAR`

`createDefaultCollection()` in `src/services/collections/collectionsDbService.js` ensures this collection exists.

Do not use `Default collection` merely because a file is stranded. Stranded media with a valid timestamp belongs in `Unfiltered Collection` under the resolved year.

## Path generation

Import-time paths are built in `src/services/bootstrap-services/importMedia.js` using:

- `path.join(String(collectionYear), collectionName, uniqueFileName)`

Read-time paths are reconstructed through `getRelativeMediaPath(year, collecionName, filename, id)` in `src/services/service-utils/mediaPath.js`.

`getRelativeMediaPath()` always uses the supplied `year` and `collecionName`:

- `getRelativeMediaPath(2026, 'Unfiltered Collection', 'video.mp4', id)` -> `2026/Unfiltered Collection/_<id>_video.mp4`
- `getRelativeMediaPath(2026, 'Default collection', 'video.mp4', id)` -> `2026/Default collection/_<id>_video.mp4`
- `getRelativeMediaPath(10000, 'Default collection', 'video.mp4', id)` -> `10000/Default collection/_<id>_video.mp4`

The system default behavior comes from the collection/media year being `10000`; path generation does not special-case collection labels.

## Watch-folder behavior

Watch-folder scan uses the same timestamp-selection rule as selected-library import.

In `src/services/watch-folders/watchFolders.js`, `addMediaMetricsToScannedItem(scannedItemData)`:

1. gets embedded content creation time with `getContentCreationTime(scannedItemData.path, scannedItemData.mediaType)`
2. chooses the canonical timestamp with `getPreferredMediaTimestamp(contentCreationTime, scannedItemData.birthtimeMs)`
3. stores that timestamp in `scannedItemData.birthtimeMs`
4. calculates `scannedItemData.year` with `getFileYear(scannedItemData.birthtimeMs)`

`getContentCreationTime()` returns milliseconds through `Date.getTime()`.

## Summary

- Valid embedded content creation time wins.
- Valid filesystem `birthtimeMs` is the fallback.
- Missing, invalid, or future timestamps route to year `10000`.
- Valid-date stranded media goes to `YYYY/Unfiltered Collection`.
- Unknown-date media goes to `10000/Default collection`.
- Path reconstruction uses the stored/resolved year and does not special-case collection labels.
