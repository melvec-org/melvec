# Coding standards

## General principles

- Follow the existing Electron architecture strictly:
    - main-process logic stays under `src/main`
    - renderer/UI logic stays under `src/ui`
    - cross-process communication goes through preload + IPC
- Preserve the existing service layering and feature boundaries. Do not bypass preload, IPC, or service modules.
- Prefer extending the nearest existing feature module over introducing new top-level abstractions.
- Keep changes focused and surgical. Avoid unrelated refactors in the same change.
- Write descriptive names and keep functions small, explicit, and easy to test.
- Add comments only where logic is non-obvious; avoid noise comments.
- Maintain backward compatibility unless a breaking change is explicitly agreed.

## React and Nodejs guidelines

### React / renderer guidelines

- Keep UI components in `src/ui/components` or `src/ui/views`.
- Route renderer behavior through the existing action/hook layer in `src/ui/actions`.
- Do not call main-process internals directly from renderer code.
- Prefer component and hook names that match the surrounding feature terminology.
- Keep UI state concerns separate from filesystem, IPC, and database mutation logic.

### Node.js / Electron / main-process guidelines

- Keep main-process behavior under `src/main`.
- Expose renderer-accessible APIs only through `src/main/preload.js`.
- Do not expose raw Node.js or Electron primitives directly to the renderer.
- Keep preload changes minimal and explicit.
- When adding a new renderer-facing capability, update all affected layers consistently:
    - `src/main/preload.js`
    - `src/constants/ipcChannels.js`
    - `src/services/serviceGateway.js`
    - the relevant `src/services/**` implementation
    - the consuming UI/action layer

### IPC guidelines

Based on the patterns documented in `dev-docs/development.md` and `dev-docs/naming-conventions.md`:

- Use direct async IPC for cached data and database-style request/response operations.
- Use the event fire model for long-running chains and physical file operations.
- Do not introduce raw IPC string literals in feature code.
- Add shared channels to `src/constants/ipcChannels.js`.
- Follow the naming convention documented in `dev-docs/naming-conventions.md`:
    - `*_REQUEST` for renderer/preload -> main
    - `*_ACTION` for main -> renderer
    - `*_EVENT` only for stream-style or legacy cases

## File organization

- Place new code in the nearest existing feature folder under `src/services` rather than creating broad shared modules too early.
- Common service areas already used in the codebase include:
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
- Prefer source changes under `src`.
- Do not modify generated or packaged output such as `dist` or `dist-mac` unless explicitly requested.
- Do not work in discarded content under `discard` unless explicitly requested.

## Naming conventions

Follow the documentation for naming conventions [here](./naming-conventions.md)

Additional expectations used throughout the repository:

- Match existing file suffixes and module naming patterns.
- Reuse established folder names and feature terminology.
- Prefer semantic names over implementation-specific names.
- Common patterns already in use:
    - `*.service.js` for service API surfaces
    - feature logic files such as `playlists.js`, `search.js`, `relatedVideos.js`
    - `*DbService.js` for database helpers
    - colocated `*.test.js` files for Jest tests

## Code structure

Follow the existing application call chain:

1. UI component in `src/ui/components` or `src/ui/views`
2. Common Action/hook layer in `src/ui/actions`
3. Electron bridge in `src/main/preload.js`
4. IPC/service gateway in `src/services/serviceGateway.js`
5. Feature service module `*.service.js`
6. Feature logic module in the same service area
7. Database / service-utils / filesystem layer as needed

Additional structure rules:

- Do not let renderer code reach into main-process internals directly.
- Keep APIs narrow and explicit.
- Prefer pure and deterministic logic where practical, especially in utility-style service areas.
- Avoid mixing UI state handling with persistence or filesystem mutation.
- For error logging, follow the split documented in `dev-docs/development.md`:
    - use system-level logging for startup, Electron, preload, IPC, dialog, and global runtime failures
    - use library-level logging for selected-library import, metadata, database, and media-processing failures

## Testing

- Jest is the test framework used in this repository.
- Follow the existing pattern of colocated `*.test.js` files next to the implementation.
- All new features should have accompanying tests.
- Bug fixes should include regression tests when practical.
- When changing an implementation file, check for an adjacent test file first and extend it.
- Manually test changes thoroughly before opening a PR.
- For major changes, consider broader integration or end-to-end coverage when appropriate.

## Version control / PRs

- Use a focused branch name such as `feature/xxx`, `bugfix/yyy`, or `docs/zzz`.
- Keep each branch and PR scoped to one logical change.
- Use clear conventional commit messages.
- Reference the related issue in commits or PRs when applicable.
- Fill out the PR template completely.
- In the PR description, explain both what changed and why.
- Include screenshots or recordings for UI changes when relevant.
- Mark the PR as Draft while work is still in progress.
- Expect review for correctness, maintainability, performance, and security.

## Tools & enforcement

- Match the repository formatting conventions described in `.prettierrc`:
    - `tabWidth: 4`
    - `singleQuote: true`
    - `printWidth: 140`
- Follow the existing linting and formatting rules and run them locally before submitting.
- Use the smallest relevant validation first, then broaden as needed.
- Run targeted tests for the changed area, and run `npm run build` when renderer, preload, or import wiring may be affected.
