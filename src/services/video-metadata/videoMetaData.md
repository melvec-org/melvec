# Video Metadata Service

## Overview

The `videoMetaData` service manages all metadata associated with videos in the library. This includes AI-generated and user-provided descriptions, audio transcripts, and embedding vectors used for semantic search. It orchestrates calls to the AI generation pipeline, persists results to the database, and notifies the UI of changes. It also supports both single-video and batch metadata generation workflows.

---

## Location

`src/services/video-metadata/videoMetaData.service.js`

---

## Architecture

The call flow for this service follows the standard application pattern:

`IPC Handler / Service Gateway` → `videoMetaData.service.js` → `generateVideoMetaData.js` → AI Pipeline (Whisper / LLaMA)

`IPC Handler / Service Gateway` → `videoMetaData.service.js` → `metaDataDbService.js` → `SQLite (better-sqlite3)`

---

## Exported Functions

### `initMetaDataService()`

Initializes the metadata database service and prepares any required state.

- **Returns:** `void`
- **Usage:** Called once during application bootstrap before any metadata operations are performed.

---

### `getVideoMetaDataDetails(videoId)`

Retrieves the full metadata record for a video, including description, transcript, and source labels.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video.
- **Returns:** `object | null` — A metadata details object, or `null` if not found.

---

### `getShortVideoDescriptionService(videoId)`

Retrieves a truncated version of the video description, suitable for display in list or card views.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video.
- **Returns:** `object` — A response object containing the short description string.
- **Notes:**
    - The maximum short description length is controlled by `MAX_SHORT_DESCRIPTION_LENGTH` in `appConfig`.

---

### `setVideoMetaDataDescriptionService(videoId, description)`

Persists a user-provided description for a video and triggers embedding generation for the new text.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video.
    - `description` _(string)_ — The description text provided by the user.
- **Returns:** `Promise<object>` — A success or error response object.
- **Notes:**
    - Saves the description with source label `'user'`.
    - After saving, generates and stores normalized description and embedding vectors.
    - Notifies the UI of an integrity change on success.

---

### `generateVideoDescriptionService(videoId, shouldGenerateTitle)`

Triggers the full AI metadata generation pipeline for a single video. Generates a description, transcript, and optionally a title.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video.
    - `shouldGenerateTitle` _(boolean)_ — When `true`, an AI-generated title will replace the existing one, or fill it if empty.
- **Returns:** `Promise<object>` — A success response containing the generated transcript and description, or an error response on failure.
- **Notes:**
    - Resolves the full video path using `servicePathConfig`.
    - Selects the appropriate AI model tier via `getModelTier()`.
    - Only persists the description if it is longer than 5 characters.
    - Notifies the UI of an integrity change on success.

---

### `generateTranscriptService(videoId)`

Generates an audio transcript for a video without triggering full metadata generation.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video.
- **Returns:** `Promise<object>` — A success or error response object containing the transcript.

---

### `stopGeneratingVideoDescriptionService(videoId)`

Cancels an in-progress AI metadata generation job for a single video.

- **Parameters:**
    - `videoId` _(string)_ — The unique identifier of the video whose generation should be stopped.
- **Returns:** `void`

---

### `startBatchVideoMetaDataGenerationService(videoIds)`

Starts a batch metadata generation job across multiple videos. Processes each video sequentially using the current model tier.

- **Parameters:**
    - `videoIds` _(Array<string>)_ — An array of video IDs to process.
- **Returns:** `Promise<void>`
- **Notes:**
    - Delegates per-video processing to `batchGenerateVideoMetaData.js`.
    - For each video, generates a title only if the existing title is empty or `'Untitled'`.
    - Emits progress events to the UI during processing.

---

### `stopBatchVideoMetaDataGenerationService()`

Cancels an active batch metadata generation job.

- **Returns:** `void`
- **Notes:**
    - Sets a cancellation flag that causes the batch loop to exit after the current video completes.

---

## Helper Files

### `generateVideoMetaData.js`

The core AI orchestration module. Responsible for running the full generation pipeline for a single video.

**Technical approach:**

- Extracts audio from the video file using `ffmpeg`.
- Passes the audio to `whisper-cli` to produce a raw transcript.
- Feeds the transcript into a locally running LLaMA model to generate a structured description and optionally a title.
- Returns a result object containing `description`, `transcript`, and `generatedTitle`.
- Exposes `stopGeneratingVideoMetadata()` which signals the underlying process to terminate early.
- Exposes `generateEmbeddingsFromDescription()` which takes a plain-text description and returns a vector embedding suitable for semantic search indexing.

**Exports:**

- `generateVideoMetadata(videoId, fullVideoPath, modelTier, shouldGenerateTitle)`
- `stopGeneratingVideoMetadata(videoId)`
- `generateEmbeddingsFromDescription(videoId, description)`

---

### `batchGenerateVideoMetaData.js`

Handles the per-video processing logic invoked during a batch generation run. Keeps the batch orchestration logic separate from the service layer.

**Technical approach:**

- Accepts a `videoId` and `modelTier` for each video in the batch.
- Resolves the full file path using `getLibDir()` from `servicePathConfig`.
- Reads the current video details from `videoLibraryDbService` to determine whether a title should be generated.
- A title is generated only when the existing title is blank or equals `'Untitled'`.
- Delegates the actual AI generation to `generateVideoMetadata()`.
- Persists the description via `setGeneratedVideoMetaData()` only when the result is longer than 5 characters.
- Calls `udpateVideoTitle()` from `videoLibrary.js` if a new title was produced.

**Exports:**

- `__processVideoMetaData(videoId, modelTier)` — intended for internal use by the batch orchestration loop only.

---

## Dependencies

| Module                          | Purpose                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `generateVideoMetaData.js`      | Runs the AI pipeline to produce descriptions, transcripts, and titles |
| `batchGenerateVideoMetaData.js` | Handles per-video processing logic during batch generation            |
| `metaDataDbService.js`          | All read/write operations against the SQLite metadata table           |
| `videoLibraryDbService.js`      | Reads video details such as path and existing title                   |
| `videoLibrary.js`               | Calls `udpateVideoTitle` when applying AI-generated titles            |
| `servicePathConfig.js`          | Resolves the library root directory for building full file paths      |
| `ai-services/models.js`         | Provides the current model tier for AI generation                     |
| `service-utils/sendToUI.js`     | Wraps results in standard `respondSuccess` / `respondError` envelopes |

---

## Related Services

| Service           | Relationship                                                                      |
| ----------------- | --------------------------------------------------------------------------------- |
| `videoLibrary.js` | Provides `udpateVideoTitle` used when persisting AI-generated titles              |
| `search`          | Consumes description embeddings stored by this service for semantic search        |
| `related-videos`  | Uses embedding vectors produced during metadata generation for similarity scoring |
| `import-export`   | May read description and transcript data during export operations                 |
| `watch-folders`   | May trigger metadata generation after a new video is imported                     |

---

## Data Flow

### Single Video Generation

`generateVideoDescriptionService` → `generateVideoMetadata` (AI pipeline) → `setGeneratedVideoMetaData` (DB) → `udpateVideoTitle` (if applicable) → `notifyIntegrityChange` (UI)

### User Description Update

`setVideoMetaDataDescriptionService` → `setDescription` (DB) → `generateEmbeddingsFromDescription` (AI) → `setEmbeddingData` (DB) → `notifyIntegrityChange` (UI)

### Batch Generation

`startBatchVideoMetaDataGenerationService` → `__processVideoMetaData` (per video) → `generateVideoMetadata` (AI pipeline) → `setGeneratedVideoMetaData` (DB) → `udpateVideoTitle` (if applicable)
