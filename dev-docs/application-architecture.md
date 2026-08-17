# Melvec Architecture

Melvec is an Electron desktop application with a strict split between the **renderer process** and the **main process**.

- The main-process entry point is `src/main/main.js`.
- Renderer UI code lives under `src/ui`.
- Cross-process communication goes through `src/main/preload.js` and IPC.
- Backend-style feature logic lives under `src/services`.

This document explains the main architectural layers, how they communicate, and the patterns contributors should preserve when extending the application.

## Core process model

Melvec uses the standard Electron two-process model:

### 1. Renderer process

The renderer is the user interface layer.

- Built with React
- Styled with CSS files under `src/ui`
- Responsible for rendering views, handling user interaction, and managing client-side UI state
- Must not call Node.js or Electron APIs directly

Primary renderer areas:

- `src/ui/components`
- `src/ui/views`
- `src/ui/actions`
- `src/ui/contexts`

### 2. Main process

The main process owns Electron integration and application-level orchestration.

- Creates and manages windows
- Registers menus, dialogs, and IPC handlers
- Initializes services and library state
- Coordinates filesystem, database, and long-running operations

Primary main-process areas:

- `src/main/main.js`
- `src/main/windows.js`
- `src/main/preload.js`
- `src/main/registerIpcHandlers.js`
- `src/main/bootstrap.js`

## Architectural layers

Melvec follows a layered call flow from UI interaction down to feature logic and persistence.

### Standard call chain

1. UI component in `src/ui/components` or `src/ui/views`
2. Action or hook layer in `src/ui/actions`
3. Electron bridge in `src/main/preload.js`
4. IPC / service gateway in `src/services/serviceGateway.js`
5. Feature service module `*.service.js`
6. Feature logic module in the same service area
7. Database, service-utils, or filesystem layer as needed

This layering keeps process boundaries clear and avoids mixing UI concerns with backend logic.

## Layer responsibilities

### UI components and views

Files under `src/ui/components` and `src/ui/views` are responsible for:

- rendering the interface
- handling local interactions
- dispatching application-context updates
- calling renderer-safe APIs exposed through `window.api`

UI components should not contain filesystem logic, database access, or direct Electron calls.

### Action and hook layer

Files under `src/ui/actions` and feature-local hooks coordinate UI behavior before calling into the preload bridge.

Responsibilities include:

- preparing UI-driven payloads
- translating user actions into service calls
- handling feature-local orchestration on the renderer side

### Preload bridge

`src/main/preload.js` is the security and communication boundary between the renderer and main process.

It uses `contextBridge.exposeInMainWorld(...)` to expose safe APIs on `window.api`.

Responsibilities:

- allow approved `invoke` calls
- allow approved `send` / `receive` IPC channels
- prevent exposing raw Node.js or Electron objects directly to the renderer

This layer must stay minimal and explicit.

### Service gateway and IPC registration

The main gateway for renderer-originated service calls is:

- `src/services/serviceGateway.js`

This module:

- initializes service configuration
- sets the library root via `src/services/servicePathConfig.js`
- initializes primary services
- registers IPC handlers through `src/services/ipc/registerHandlers.js`
- binds renderer event subscriptions through `src/services/ipc/eventSubscriptions.js`

This is the central boundary where renderer requests are mapped to backend services.

### Feature service modules

Feature service modules typically use the `*.service.js` suffix.

Examples include service files under:

- `src/services/search`
- `src/services/playlists`
- `src/services/watch-folders`
- `src/services/video-library`
- `src/services/import-export`

Responsibilities:

- expose the feature API to the gateway or handler layer
- coordinate feature-specific logic
- shape results for the UI
- delegate detailed work to lower-level logic modules

### Feature logic modules

Feature logic files hold the domain logic behind a service API.

Examples of naming patterns already in use:

- `search.js`
- `playlists.js`
- `relatedVideos.js`

Responsibilities:

- data processing
- ranking/filtering logic
- domain-specific orchestration
- reacting to service-level events

### Database and filesystem layers

Persistence and file operations live below the feature logic layer.

Typical locations include:

- `src/services/database`
- feature-specific DB service files such as `*DbService.js`
- `src/services/service-utils`

Responsibilities:

- database reads/writes
- filesystem access
- utility functions shared across services
- long-running physical operations

## Communication patterns

Melvec uses two main renderer-to-main communication patterns.

### 1. Direct async IPC

Use direct async IPC for:

- cached data reads
- database-style request/response operations
- operations that return a result directly

Typical path:

`UI -> action/hook -> preload -> registered IPC handler -> service -> logic -> result back to renderer`

### 2. Event-driven messaging

Use event-driven messaging for:

- long-running operations
- file imports/exports
- download/progress workflows
- operations that emit progressive state changes

Typical path:

`UI -> preload send/request -> main-process event handling -> service work -> event/action pushed back to renderer`

Shared channel and event names are centralized through:

- `src/constants/ipcChannels.js`
- `src/events/*`

## Application bootstrap architecture

Application startup is coordinated from:

- `src/main/main.js`
- `src/main/windows.js`
- `src/main/bootstrap.js`

At a high level:

1. Electron reaches `app.whenReady()` in `src/main/main.js`
2. System logging is initialized with `initSystemLogService(...)`
3. The main window is created via `createWindow(...)`
4. The preload bundle is attached to the window
5. The renderer loads `dist/index.html`
6. `bootstrap(webContents)` runs after renderer load
7. The library path is validated
8. Core services are initialized through `serviceGateway.init(...)`
9. Secondary services are initialized after successful validation/import
10. Initial state is emitted back to the UI

This keeps application startup centralized in the main process while allowing the renderer to remain a consumer of the initialized state.

## Initial library state architecture

The initial application/library state returned to the UI is assembled in:

- `src/services/serviceGateway.js`
- `getInitialLibraryState()`

This state includes:

- tags
- playlists
- collections
- watch folders
- video categories
- user preferences
- hidden-collection preference state

The renderer receives this state during bootstrap completion and uses it to initialize `ApplicationContext` in `src/ui/app.js`.

## Event model

Melvec uses several event namespaces to keep different types of events separated.

Important event groups include:

1. `interServiceEvents`
    - service-to-service events inside the backend/service layer
2. `mainThreadEvents`
    - events emitted from main/service layers back to the UI
3. `applicationEvents`
    - renderer-side application state transitions
4. `contextMenuEvents`
    - context-menu related actions
5. `rendererEvents`
    - renderer-originated events listened to by the main process
6. `applicationMenuEvents`
    - application-menu initiated actions

These event constants live under `src/events` and are part of the communication contract across layers.

## Folder organization

The most important top-level source folders are:

- `src/main` — Electron main-process bootstrapping, windows, preload, IPC registration
- `src/ui` — renderer UI, views, components, actions, and contexts
- `src/services` — feature services, feature logic, DB access, utilities, and IPC service handlers
- `src/events` — application, renderer, inter-service, and menu event constants
- `src/constants` — shared constants including IPC channel names and service method names
- `src/configs` — runtime and development configuration

## Common service areas

Feature logic is usually placed in the nearest existing service folder rather than a new global abstraction.

Common folders already used include:

- `collections`
- `playlists`
- `search`
- `related-videos`
- `video-library`
- `video-metadata`
- `video-metrics`
- `watch-folders`
- `application-settings`
- `history`
- `import-export`
- `database`
- `service-utils`

## Architecture rules for contributors

When changing or adding behavior:

- keep main-process logic in `src/main`
- keep UI logic in `src/ui`
- route cross-process access through `src/main/preload.js`
- do not have renderer code call main-process internals directly
- preserve existing service layering and folder placement
- prefer extending existing feature modules over inventing new generic abstractions
- keep APIs narrow and explicit

## Anti-patterns to avoid

Avoid introducing these patterns:

- direct Node.js or Electron access from renderer components
- business logic embedded deeply inside React components
- filesystem or database mutation mixed into UI state handling
- raw IPC string literals scattered across feature code
- bypassing `src/services/serviceGateway.js` or the handler layer without strong reason
- broad preload exposure when a narrow API would be sufficient

## Related documents

For more implementation detail, see:

- `dev-docs/development.md`
- `dev-docs/coding-standards.md`
- `dev-docs/naming-conventions.md`
- `dev-docs/command-flows.md`

### Architecture details

- `dev-docs/location-architecture.md`
- `dev-docs/search/content-search.md`
- `dev-docs/search/search-response-mechanism.md`
- `dev-docs/command-flows/search-control.md`
