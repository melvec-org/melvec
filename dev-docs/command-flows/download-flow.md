# Download flow

Melvec supports event-style communication for long-running operations. The shared event channel for this pattern is `ipcChannels.EVENT_STREAM`, defined in `src/constants/ipcChannels.js`.

This pattern is intended for operations that do not complete immediately and may need incremental progress updates, status changes, or cancellation handling.

## Why event streaming is needed

Simple request/response IPC works well for fast operations, but it is not a good fit for work such as:

- file downloads
- imports and exports
- AI processing jobs
- transcoding
- long-running filesystem operations

For these workflows, the UI usually needs more than a final success or failure result. It may need:

- current progress
- bytes processed
- completion status
- error status
- cancellation status

## Event streaming channel

The shared stream channel is:

- `ipcChannels.EVENT_STREAM`

This channel is exposed to the renderer through `src/main/preload.js` and allowed by `receiveChannels` in `src/main/api/ipcEventApi.js`.

That means renderer code can subscribe to stream updates using:

`window.api.receive(ipcChannels.EVENT_STREAM, callback)`

## Download flow in the main process

Download handling is registered during app startup from `src/main/main.js` through:

- `registerDownloadsHandlers()`

The implementation lives in:

- `src/services/service-utils/registerDownloadsHandlers.js`

This module manages Electron and Chromium-controlled downloads using:

- `session.defaultSession.on('will-download', ...)`
- `webContents.downloadURL(url)`

## Core download state inside `registerDownloadsHandlers.js`

The module keeps download state in two process-level variables:

- `pendingChromiumDownload`
- `activeDownloadItem`

These represent:

- a queued download request waiting for Electron's `will-download` event
- the current active `DownloadItem`

This allows the main process to:

- track the current download
- emit progress updates
- resolve or reject the download promise
- cancel an in-progress download

## Download request lifecycle

A Chromium-managed download starts through:

- `downloadViaChromium(url, destinationPath, webContents, onProgress)`

### Step 1: Validate the request

`downloadViaChromium(...)` rejects immediately if:

- the URL is missing
- `webContents` is missing
- another Chromium download is already active

### Step 2: Save pending request metadata

If the request is valid, it stores a pending request object containing:

- `url`
- `destinationPath`
- `resolve`
- `reject`
- `onProgress`

### Step 3: Trigger Electron download

The actual browser-managed download starts with:

- `webContents.downloadURL(url)`

This causes Electron to emit the `will-download` event on the default session.

## `will-download` event flow

Inside `registerDownloadsHandlers()`, `session.defaultSession.on('will-download', ...)` handles the actual download item.

### What happens here

1. The pending request is read
2. `activeDownloadItem` is assigned
3. The final destination path is resolved
4. If a file already exists at that path, it is removed first
5. `item.setSavePath(finalDestinationPath)` is called
6. progress and completion listeners are attached to the download item

## Progress updates

The function defines `emitProgress()` inside the `will-download` handler.

This function calculates:

- `downloadedBytes` from `item.getReceivedBytes()`
- `totalBytes` from `item.getTotalBytes()`
- `percent` when total size is known
- current `status`

It then calls the request-level `onProgress` callback with:

- `url`
- `destinationPath`
- `downloadedBytes`
- `totalBytes`
- `percent`
- `status: 'downloading'`

Progress is emitted:

- immediately once after setup
- again whenever `item.on('updated', ...)` reports `state === 'progressing'`

## Completion and failure handling

When the item finishes, `item.once('done', ...)` runs.

At that point the handler:

- reads final byte counts
- reads MIME type when available
- reads the final URL and filename
- emits one final progress callback with:
    - `status: 'completed'` or `status: 'error'`

Then it resolves or rejects the original promise.

### Successful completion

If the final state is `completed`, the promise resolves with:

- `url`
- `destinationPath`

There is also a protective validation step:

- if the downloaded file looks like HTML instead of the expected binary/model file
- the promise is rejected even though Chromium reported completion

This is used to catch cases where a server returns an HTML error page instead of the real file.

### Cancellation

If the state is `cancelled`, the promise is rejected with:

- `Error('Chromium download cancelled')`
- error code `DOWNLOAD_CANCELLED`

### Failure

Any other non-success state rejects the promise with a detailed error containing:

- final URL
- final filename
- MIME type
- bytes received
- total bytes

## Download cancellation flow

Cancellation is handled by:

- `cancelChromiumDownload()`

This function checks `activeDownloadItem` and calls:

- `activeDownloadItem.cancel()`

If cancellation succeeds, Electron eventually reports the cancelled state in the `done` handler, and the original download promise is rejected.

## Renderer-side event subscription pattern

The download handler itself uses an `onProgress` callback internally, but the repo’s general event-streaming pattern is exposed through:

- `ipcChannels.EVENT_STREAM`
- `window.api.receive(...)`
- `window.api.stop(...)`

In `src/main/api/ipcEventApi.js`, `EVENT_STREAM` is an allowed receive channel. This establishes the renderer-side convention for long-running event updates.

Typical renderer subscription pattern:

```js
window.api.receive(ipcChannels.EVENT_STREAM, (message) => {
    // handle progress, completion, failure, etc.
});
```

Cleanup pattern:

```js
window.api.stop(ipcChannels.EVENT_STREAM, callback);
```

## Conceptual event-streaming flow

Using download as the example, the event-driven pattern looks like this:

1. Renderer starts a long-running operation
2. Main process begins the operation
3. Main process attaches progress listeners
4. Main process emits incremental progress updates
5. Renderer updates UI state as progress arrives
6. Main process emits completion, failure, or cancellation state
7. Renderer finalizes the UI state

## Example conceptual flow

`Renderer UI`  
→ requests download start  
→ main process starts `downloadViaChromium(...)`  
→ Electron emits `will-download`  
→ main process tracks `DownloadItem`  
→ progress events are produced during `updated`  
→ final state is handled in `done`  
→ renderer receives progress/completion/error updates  
→ UI reflects the final result

## Important implementation notes

- Download registration happens once during startup through `registerDownloadsHandlers()` in `src/main/main.js`
- Download state is centralized in `src/services/service-utils/registerDownloadsHandlers.js`
- Electron session download hooks are used instead of custom HTTP streaming logic
- The repo supports a generic stream channel with `ipcChannels.EVENT_STREAM` for long-running UI updates
- Renderer subscriptions are wrapped safely through `src/main/preload.js` and `src/main/api/ipcEventApi.js`

## Summary

The event-streaming model in Melvec is designed for long-running work where the UI needs incremental updates.

Using downloads as an example:

- the operation starts in the main process
- Electron emits native download lifecycle events
- progress is calculated from the active `DownloadItem`
- completion, failure, and cancellation are all handled explicitly
- renderer-side consumption is designed to happen through the shared event subscription pattern exposed on `window.api`

This same architecture can be reused for imports, exports, AI jobs, transcoding, and other progressive workflows.
