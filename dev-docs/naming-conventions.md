# Naming Conventions

## IPC channel naming convention

IPC channel names are centralized in `src/constants/ipcChannels.js`.

### Directional naming

- `*_REQUEST` — renderer/preload -> main
  Use for fire-and-forget requests initiated from the UI.
- `*_ACTION` — main -> renderer
  Use for user-selected commands or state updates delivered back to the UI.
- `*_EVENT` / stream-style names — reserved for ongoing event streams or legacy cases where request/action naming is not a natural fit.

### Examples

- `OPEN_HELP_WINDOW_REQUEST`
- `CONTEXT_MENU_REQUEST`
- `CONTEXT_MENU_ACTION`
- `APPLICATION_MENU_ACTION`
- `ZOOM_FACTOR_CHANGE_ACTION`

### Rules

- Do not introduce new raw IPC string literals in renderer, preload, or main process code.
- Add every shared IPC channel to `src/constants/ipcChannels.js`.
- Prefer semantic names based on message direction instead of UI-specific implementation details.
- When migrating legacy channels, keep the runtime string stable if needed, but update the exported constant name first.

### Current exception patterns

Some existing channels are intentionally still named outside the request/action convention:

- `EVENT_STREAM` — long-running progress/event broadcasting
- legacy channels that have not yet been migrated

These should be migrated incrementally rather than renamed all at once.

## UI layer (React)

| Type of file           | Convention                | Example             |
| :--------------------- | :------------------------ | :------------------ |
| React component name   | \<ComponentName\>.js      | AddNewCollection.js |
| React event hooks      | use\<ComponentName\>.js   | usePlaylist.js      |
| Component speficic css | \<ComponentName\>.css     | Playlist.css        |
| Context                | \<contexName\>.context.js | playlist.context.js |
| Test cases             | \<ComponentName\>.test.js | Playlist.test.js    |

## Main Process and Service Layer

| Type of file      | Convention                 | Example                 |
| :---------------- | :------------------------- | :---------------------- |
| Core Service file | \<serviceName\>.js         | relatedVideo.js         |
| Service           | \<serviceName\>.service.js | relatedVideo.service.js |
| Events            | \<eventName\>Event.js      | interServiceEvents.js   |
| Errors            | \<serviceName>.errors.js   | aiModels.errors.js      |

### Folder names

Folder names to follow kebab case , ex: welcome-message
