# Welcome to development guide

Quick links

1. [Contribution Guidelines](../CONTRIBUTING.md)
2. [Architecture overview](./application-architecture.md)
3. [API Reference](./api-reference/all.md)
4. [Testing Melvec](./manual-testing-workflows.md)
5. [Coding Standards](./coding-standards.md)

## Getting started

### Local setup / prerequisites

Install dependencies with

```
npm install
```

If native modules fail

```
run npm run rebuild
```

Build bundles with

```
npm run build
```

Start Electron with

```
npm start
```

### Architecture overview.

Read [Application Architecture](./application-architecture.md) to understand the code base.

### Folder structure

- src/main — Electron main process
- src/ui — renderer React UI
- src/services — feature/business logic and service modules
- src/events — event-driven wiring
- src/constants — shared constants including IPC channels
- dev-docs — internal docs

## Development Workflow

When working on a feature, bug fix, or documentation update, follow this standard workflow.

### Steps

1. **Pick or create an issue**
    - Check the project issue tracker for existing work.
    - If the work is not already tracked, create or discuss an issue before starting large changes.

2. **Set up your development environment**
    - Install dependencies with `npm install`.
    - If native dependencies need rebuilding, run `npm run rebuild`.
    - Build the project with `npm run build`.
    - Start the application with `npm start`.

3. **Create a branch**
    - Use a clear branch name based on the type of work.
    - Examples: `feature/xxx`, `bugfix/yyy`, `docs/zzz`.

4. **Develop the change**
    - Follow the architecture documented in _Application Architecture_.
    - Follow the coding rules in _Coding Standards_.
    - Keep the change focused and avoid unrelated refactors.
    - Preserve the existing call flow through `src/ui`, `src/main/preload.js`, and `src/services/serviceGateway.js`.

5. **Write or update tests**
    - Add tests for new functionality.
    - Add regression tests for bug fixes when practical.
    - Follow the existing Jest pattern with colocated `*.test.js` files.

6. **Update documentation**
    - Update relevant internal docs under `dev-docs` when behavior, architecture, or conventions change.
    - Update `README.md` or API docs if the change affects users or contributors.

7. **Validate the change**
    - Run targeted tests first when possible.
    - Useful commands:
        ```bash
        npm test -- --runInBand <path-to-test-file>
        npm test -- --runInBand
        npm run lint
        npm run build
        ```

8. **Commit and push**
    - Use clear conventional commit messages.
    - Reference the related issue when applicable, for example:
        - `Fixes #123`
        - `Closes #123`

9. **Submit a Pull Request**
    - Fill out the PR template completely.
    - Explain what changed and why.
    - Link the related issue.
    - Include screenshots or recordings for UI changes when relevant.
    - Mark the PR as Draft if the work is still in progress.

10. **Address review feedback**
    - Respond to comments promptly.
    - Make requested changes clearly and keep the branch updated.

### Workflow Principles

- Keep each PR focused on one logical change.
- Prefer small, reviewable changes over large mixed refactors.
- Follow existing patterns before introducing new abstractions.
- Update tests and documentation alongside code changes.

## Call Flow Guidance

Melvec follows a strict layered call flow between the renderer and the main process. This architecture is also documented in [Application Architecture](../architecture.md).

## Standard Call Chain

1. **UI component** in `src/ui/components` or `src/ui/views`
2. **Action or hook layer** in `src/ui/actions` **for common actions or respective actions beisde the component**
3. **Electron bridge** in `src/main/preload.js`
4. **IPC handler / gateway** in `src/services/serviceGateway.js`
5. **Feature service module** `*.service.js`
6. **Feature logic module** in the same service area
7. **Database, service-utils, or filesystem layer** as needed

## Why This Flow Exists

This layering keeps responsibilities separated:

- Renderer code stays focused on UI behavior
- Preload acts as the safe boundary between renderer and Electron
- `src/services/serviceGateway.js` centralizes IPC handling
- `*.service.js` files expose service APIs
- Feature logic files hold the application logic
- Database and filesystem code stay isolated from UI concerns

**Do not skip layers** unless there is already an established pattern in that feature area.

## Renderer-to-Main Communication Patterns

Melvec uses two communication patterns:

### 1. Direct Async IPC Calls

Use direct async IPC when the operation is request/response oriented, especially for:

- Cached data reads
- Database-style operations
- Fast queries that return a result directly

**Typical flow:**
UI component → action/hook → `src/main/preload.js` → `src/services/serviceGateway.js` → `*.service.js` → logic / DB → response back to UI

### 2. Event-Driven Messaging

Use event-driven messaging for operations that are long-running or produce progressive updates, especially for:

- Long processing chains
- Physical file operations
- Workflows that emit progress, completion, or status events

**Typical flow:**
UI component → action/hook → `src/main/preload.js` → event/request trigger → main-process event handling → service/logic/filesystem work → action/event pushed back to renderer

## Contributor Rules

- Do not call main-process internals directly from renderer code.
- Do not expose raw Node.js or Electron APIs directly to the renderer; use `src/main/preload.js`.
- Before adding a new cross-process interaction, inspect:
    - `src/main/preload.js`
    - `src/constants/ipcChannels.js`
    - `src/services/serviceGateway.js`
    - Relevant files under `src/events`
- Prefer reusing an existing IPC channel or event pattern before creating a new one.
- Keep new renderer-facing APIs narrow and explicit.
- When adding a new cross-process feature, update all affected layers consistently.

## Practical Examples

**Use the direct async pattern when:**

- Loading cached metadata
- Running database-backed queries
- Fetching a known result immediately

**Use the event-driven pattern when:**

- Importing files
- Scanning folders
- Running background processing
- Performing long filesystem operations

## Placement Guidance

When implementing a new flow:

- Keep UI entry points in `src/ui`
- Keep bridge code in `src/main/preload.js`
- Keep IPC routing in `src/services/serviceGateway.js`
- Place feature logic in the nearest existing folder under `src/services`
- Place DB helpers in feature DB service files or under `src/services/database`

## Anti-Patterns to Avoid

- Renderer components calling Electron or Node APIs directly
- Business logic embedded inside React components
- Filesystem or database mutation logic mixed into UI state code
- Adding raw IPC string literals instead of using `src/constants/ipcChannels.js`
- Bypassing `src/services/serviceGateway.js` or existing service layers without a strong reason

**Patterns**

1. Direct async mode call from renderer process to main process
    - For all cached data
    - For all database operation
2. Event fire model from renderer process to main process
    - For all long chaining process
    - For all physical file operations

## Error logging

Melvec uses a two-level error logging mechanism so that errors can be captured both before a library is selected and after a library is active.

### 1. System-level logging

System-level logging is intended for application-wide failures that are not owned by a specific library.

Use system-level logging for:

- application startup failures
- Electron main-process errors
- preload / IPC wiring failures
- native file dialog failures
- first-run errors before a library has been selected
- any error that belongs to the app runtime rather than library content

Current implementation:

- `src/services/logs/logService.js`
    - `initSystemLogService(logDirectoryPath)`
    - `logSystemError(errorMessage)`
    - `clearSystemLogs()`
    - `getSystemLogStat()`

System logs are initialized from the Electron main process using an application-level writable location.

Example:

- `src/main/main.js`
    - `initSystemLogService(app.getPath('userData'))`

This keeps system logs available even on first run, before the user has chosen a library.

### 2. Library-level logging

Library-level logging is intended for failures that belong to a specific media library.

Use library-level logging for:

- import/export problems tied to a selected library
- library metadata processing errors
- database issues for a specific library
- thumbnail / preview / media-processing failures scoped to one library
- any error that should stay with the library for diagnosis later

Current implementation:

- `src/services/servicePathConfig.js`
    - `getLibraryErrorLogFilePath()`
- `src/services/logs/logService.js`
    - `initLibraryLogService()`
    - `logLibraryError(errorMessage)`
    - `clearLibraryLogs()`
    - `getLibraryLogStat()`

Library logs depend on the library root path being available. They must only be initialized after the active library path has been resolved and set.

### 3. Initialization rules

#### System log initialization

Initialize system logging as early as possible during app startup.

Example:

- `src/main/main.js`
    - call `initSystemLogService(app.getPath('userData'))` inside app startup flow

#### Library log initialization

Initialize library logging only after the library root has been selected or restored.

That means:

- the library root path must already be set in `src/services/servicePathConfig.js`
- only then should `initLibraryLogService()` be called

### 4. Current usage example

Main-process IPC failures are currently treated as system-level errors.

Example:

- `src/main/registerIpcHandlers.js`
    - import file dialog failures call `logSystemError(...)`
    - save dialog failures call `logSystemError(...)`

This is intentional because these failures belong to app runtime / Electron interaction, not to one specific library.

### 5. Logging guidelines for contributors

Use `logSystemError(...)` when:

- the app fails before a library is available
- the error is tied to Electron, startup, preload, IPC, menus, dialogs, or global app state
- the issue should be visible regardless of which library is active

Use `logLibraryError(...)` when:

- the error belongs to a specific selected library
- the issue is part of media import, library processing, library database operations, or library-owned assets

Do not collapse both logging types into one generic logger call. Keep the call site explicit so the error destination is always clear.

### 6. Design rationale

This split exists because system-level and library-level failures have different lifecycles:

- system errors must work on first run and before library selection
- library errors should stay attached to the relevant library

This avoids losing startup errors while still preserving library-specific diagnostics where they belong.
