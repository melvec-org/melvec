# Command flows

This doc helps contributors understand the main interaction flows in the application.

- [Application Bootstrap](./command-flows/application-bootstrap.md)
- [UI Bootstrap](./command-flows/ui-bootstrap.md)
- [Event streaming in download](./command-flows/download-flow.md)
- [Search in action](./command-flows/search-control.md)

## Common media IPC flow

Common media operations follow this path:

`UI -> preload -> src/services/ipc/registerHandlers.js -> src/services/ipc/handlers/commonMedia.handlers.js -> src/services/commonMediaService.js -> media-specific service`

`commonMedia.handlers.js` owns IPC-level validation before service delegation:

- `validateRenameMediaArgs` for file rename requests
- `validateBulkMediaArgs` for bulk media requests
- `validateMediaOperationArgs` for single media operations
- `isNonEmptyString` checks for required string arguments such as collection IDs and initiators

`commonMediaService.js` then dispatches by `mediaType` to the concrete video, image, or audio implementation. Supported shared media types are:

- `video`
- `image`
- `audio`

Examples:

- `renameMediaFileService` routes to `renameVideoFile`, `renameImageFileService`, or `renameAudioFileService`.
- `removeMediaService` routes to `removeVideoFromLibraryService`, `removeImageFromLibraryService`, or `removeAudioFromLibraryService`.
- `bulkMediaCollectionChangeService` routes to the matching collection move function for video, image, or audio.
- `getMediaBasicDetailsService` and `getAllMediaShortInfoService` return normalized media details across video, image, and audio.
