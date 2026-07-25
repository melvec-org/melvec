# Search control flow

Search in Melvec follows the standard renderer-to-main-to-service flow used throughout the app. For search, the request starts in the UI, crosses the Electron preload bridge, invokes a registered IPC handler, and resolves through `src/services/search/search.service.js` and `src/services/search/search.js`.

## High-level search flow

The search command flow follows this path:

`UI`  
→ `window.api.getSearchResults(...)`  
→ `src/main/api/searchApi.js`  
→ `ipcRenderer.invoke(serviceMethods.SEARCH_GET_RESULTS, ...)`  
→ registered handler in `src/services/ipc/handlers/search.handlers.js`  
→ `getSearchResults(...)` in `src/services/search/search.service.js`  
→ `search(...)` in `src/services/search/search.js`  
→ results returned back to renderer

This is a direct async IPC request/response flow, not an event-streaming flow.

## Renderer-side search entry point

The renderer-facing API for search is exposed from:

- `src/main/api/searchApi.js`

The main method is:

```js
getSearchResults: (searchText, isQuickSearch, filters) =>
    ipcRenderer.invoke(serviceMethods.SEARCH_GET_RESULTS, searchText, isQuickSearch, filters);
```

This API is made available to the renderer through:

- `src/main/preload.js`
- `src/main/api/invokeApis.js`

That means renderer code can call:

```js
window.api.getSearchResults(searchText, isQuickSearch, filters);
```

## Service method used for search

The IPC method name used for search is defined in:

- `src/constants/serviceMethods.js`

The specific constant is:

- `serviceMethods.SEARCH_GET_RESULTS`
- runtime value: `'getSearchResults'`

This constant is the shared identifier used between the preload API and the main-process handler registration.

## Main-process handler registration

Search handlers are registered through:

- `src/services/serviceGateway.js`
- `src/services/ipc/registerHandlers.js`

`src/services/serviceGateway.js` calls:

- `registerHandlers()`

`src/services/ipc/registerHandlers.js` includes:

- `searchServiceHandlers` from `src/services/ipc/handlers/search.handlers.js`

That file registers the search IPC handler:

```js
[serviceMethods.SEARCH_GET_RESULTS, async (query, isQuickSearch, filters) => getSearchResults(query, isQuickSearch, filters)];
```

So once services are initialized, a renderer call to `window.api.getSearchResults(...)` is routed into the search service layer.

## Search service layer

The first backend layer for search is:

- `src/services/search/search.service.js`

The relevant function is:

- `getSearchResults(searchString, isQuickSearch, filters)`

This function:

1. Calls `search(searchString, isQuickSearch, filters)`
2. Checks whether the result came from cache
3. If the result is not cached:
    - expands search hits into full media details
    - fills `byTags`
    - fills `byTitles`
    - fills `byFileNames`
    - fills `byMetaData`

The detail expansion is done by:

- `fillDetailsForSearchResults(arr)`

This function converts lightweight result IDs into UI-usable media objects using:

- `getFullVideoDetailsById(...)` from `src/services/video-library/videoLibrary.service`
- `getBasicImageDetailsById(...)` from `src/services/image-library/imageLibrary`

It also assigns a `relevance` index to each fleshed-out result.

## Search execution layer

The actual search logic is implemented in:

- `src/services/search/search.js`

The main function is:

- `search(searchText = '', isQuickSearch = true, filters = { fileNames: true, tags: true })`

This function is responsible for:

- empty-search short-circuiting
- result caching
- per-category search execution
- typo-correction fallback for metadata search
- result shaping and limiting

## Search result shape

`src/services/search/search.js` returns results in this structure:

- `byTags`
- `byTitles`
- `byFileNames`
- `byMetaData`
- `totalCount`
- `searchText`
- `correctedText`

If the search text is empty, it returns `noSearchData`, which is the default empty search response.

## Search categories used by the backend

The search backend builds results from multiple independent sources.

### 1. Tag search

Tag search runs through:

- `getMediaByTagSearch(keyword)`

This function:

- reads all tags from `getTags()`
- finds tag labels that contain the keyword
- resolves matching video IDs with `getVideoIdsByTag(...)`
- resolves matching image IDs with `getImageIdsByTag(...)`
- normalizes each hit with a `mediaType`

### 2. Title search

Title search runs through:

- `mediaByTitleSearch(keyword)`

This function combines:

- `getVideoByTitleSearch(keyword)` from `src/services/database/videoLibraryDbService`
- `getImagesByTitleDbSearch(keyword)` from `src/services/database/imageLibraryDbService`

### 3. File-name search

File-name search runs through:

- `getMediaByFileNameSearch(keyword)`

This function combines:

- `getVideoByFileNameDbSearch(keyword)` from `src/services/database/videoLibraryDbService`
- `getImagesByFileNameSearch(keyword)` from `src/services/database/imageLibraryDbService`

### 4. Metadata search

Metadata search runs through:

- `getMediaByMetaDataSearch(searchText, isQuickSearch)`

This combines:

- `getVideosByMetaData(searchText, isQuickSearch)` from `src/services/search/getVideosByMetaData.js`
- `getImagesByMetaData(searchText, isQuickSearch)` from `src/services/search/getImagesByMetaData.js`

## Search caching behavior

Search results are cached inside:

- `searchResultsCache`

This is an instance of:

- `LRUCache` from `src/services/service-utils/LRUCache`

The cache key is built as:

```js
const cacheKey = `${searchText}_${isQuickSearch}`;
```

If a cached result exists:

- it is returned immediately
- `isCached = true` is added to the returned object

If not cached:

- the search is computed
- the final result is stored in `searchResultsCache`

## Result limits

`src/services/search/search.js` applies different result limits depending on `isQuickSearch`.

It uses:

- `MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY`
- `MAX_SEARCH_RESULTS_CACHE_COUNT`

For quick search:

- general result categories are limited to `3`
- metadata results are limited to `5`

For non-quick search:

- category limits use `MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY`

## Typo-correction fallback

If metadata search returns no results, the search service attempts typo correction.

This flow uses:

- `ensureTypoCorrectionInitialized()`
- `getCorrectedSearchText(searchText)`

The typo-correction system is backed by:

- `getSavedTypoCorrectionVocabulary()`
- `initializeTypoCorrection(...)`
- `getCorrectionForToken(...)`
- `invalidateTypoCorrectionIndex()`

If a corrected query is produced:

- metadata search runs again using the corrected text
- `correctedText` is returned in the final response when results are found

## Cache invalidation and reindex-related behavior

Search cache invalidation is handled in:

- `onDataIntegrityChange(data)`

This function:

- clears `searchResultsCache`
- rebuilds typo-correction vocabulary for specific index changes
- invalidates typo-correction state

The relevant change events are:

- `indexingEvents.VIDEO_TITLE_CHANGE`
- `indexingEvents.VIDEO_META_DATA_CHANGE`
- `indexingEvents.IMAGE_TITLE_CHANGE`
- `indexingEvents.IMAGE_META_DATA_CHANGE`

Search subscribes to index changes through:

- `initSearch()`

Inside `initSearch()`, the service subscribes to:

- `interServiceEvents.INDEX_DATA_CHANGED`

using:

- `serviceEventBus.subscribe(...)`

This ensures search data stays fresh when indexed media data changes.

## Search service initialization

Search is initialized through:

- `initSearchService()` in `src/services/search/search.service.js`

That function calls:

- `initSearchHistoryService()`
- `initSearch()`

Search initialization becomes active as part of the broader service bootstrap triggered by:

- `serviceGateway.init(...)` in `src/services/serviceGateway.js`

## Additional search-related commands

Besides search results, `src/main/api/searchApi.js` also exposes:

- `getSearchHistory(limit)`
- `getIndexedSearchHistory()`
- `clearSearchHistory()`
- `reIndexAllData()`

These map to handlers in:

- `src/services/ipc/handlers/search.handlers.js`

and service implementations in:

- `src/services/search/search.service.js`
- `src/services/global.service`

## Summary

Search in Melvec uses a direct request/response flow:

```text
Renderer UI
  → window.api.getSearchResults(...)
  → src/main/api/searchApi.js
  → ipcRenderer.invoke(serviceMethods.SEARCH_GET_RESULTS, ...)
  → src/services/ipc/handlers/search.handlers.js
  → src/services/search/search.service.js#getSearchResults(...)
  → src/services/search/search.js#search(...)
  → tag/title/file-name/metadata search
  → optional typo correction
  → cache + result shaping
  → fleshed-out media details returned to UI
```

This flow keeps the UI thin, centralizes IPC registration, and keeps the search logic isolated inside `src/services/search/search.js` and `src/services/search/search.service.js`.

## UI search flow using `GlobalSearch`

The UI entry point for search is the `GlobalSearch` component in:

- `src/ui/components/app-header/global-search/GlobalSearch.js`

This component is rendered from:

- `src/ui/components/app-header/AppHeader.js`

`AppHeader.js` shows `GlobalSearch` whenever the current view is not `applicationViewStates.SETTINGS_VIEW`.

## UI component structure

The search UI is split into two main pieces:

- `GlobalSearch.js`
- `useGlobalSearchAction.js`

### `GlobalSearch.js`

`GlobalSearch.js` is responsible for:

- rendering the search input
- handling local UI state such as:
    - `searchText`
    - `quickSearchDropDown`
    - `showResultsPanel`
- handling keyboard navigation
- debouncing input before quick search
- opening full-search results
- rendering:
    - quick suggestions
    - related media suggestions
    - the full results panel

### `useGlobalSearchAction.js`

`useGlobalSearchAction.js` contains the search behavior logic, including:

- quick search
- full search
- search history loading
- search history updates
- selection behavior for results
- navigation to collection or playlist views
- playlist creation from search results

## Initial UI search setup

When `useGlobalSearchAction()` mounts, it preloads two pieces of search-related state:

1. `window.api.getSearchHistory()`
2. `window.api.getIndexedSearchHistory()`

These are used to initialize:

- `searchHistory`
- `indexedSearchHistory`
- default quick suggestions shown when the user focuses the search box without typing

The initial default suggestion state is created by:

- `getDefaultSearchSuggestion(searchKeywordsHistory, searchedVideosHistory)`

## Search input behavior

In `GlobalSearch.js`, the visible search input is:

```js
<input
    id="melvec-global-search"
    className={style.globalSearchInput}
    type="search"
    ...
/>
```

### Important behaviors

- `onChange` updates local `searchText`
- `useDebounce(searchText, TYPE_DEBOUNCE_TIME)` delays quick search by `500ms`
- a `useEffect(...)` watches the debounced value and calls:

```js
quickSearch(debouncedValue);
```

This means quick search is not triggered on every keystroke immediately. It runs after the debounce delay.

## Quick search flow in the UI

Quick search is handled by:

- `quickSearch(searchText)` in `src/ui/components/app-header/global-search/useGlobalSearchAction.js`

### Case 1: Empty input

If `searchText === ''`:

- the hook resets keyboard focus state
- if no filter is active and search history exists:
    - default suggestions are shown from history
- if a filter is active:
    - the suggestion list is reset
- otherwise:
    - an empty suggestion structure is shown

### Case 2: No category filter selected

If `searchFilter === ''` and the user has typed text:

1. local UI suggestions are built from:
    - tags
    - playlists
    - collections
    - search history

This is done by:

- `getQuickSearchSuggestions(searchText, applicationContext.tags, applicationContext.playlists, applicationContext.collections, searchHistory)`

2. if `searchText.length >= 2`, the UI also calls the backend:

```js
window.api.getSearchResults(searchText, true);
```

That request flows through:

- `src/main/api/searchApi.js`
- `src/services/ipc/handlers/search.handlers.js`
- `src/services/search/search.service.js`
- `src/services/search/search.js`

3. when results return, the UI merges backend search results into quick suggestions using:

- `enrichSearchSuggestions(quickSuggestions, results, applicationContext.hideHiddenCollections)`

This adds matching media results from:

- `byTags`
- `byFileNames`
- `byTitles`
- `byMetaData`

4. the UI then updates:

- `searchSuggestions`
- `focusKeys`
- `correctedSearchText`

### Case 3: Category filter selected

If a quick-search filter is selected, the behavior changes.

#### Filter: `playlists`

The UI uses:

- `getSearchSuggestionByPlaylist(searchText, applicationContext.playlists)`

This stays entirely local to the renderer.

#### Filter: `collections`

The UI uses:

- `getSearchSuggestionByCollection(searchText, applicationContext.collections, applicationContext.hideHiddenCollections)`

This also stays local to the renderer.

#### Filter: `filenames`

The UI starts with:

- `getSearchSuggestionByFileNames()`

If `searchText.length >= 2`, it then requests backend results with:

```js
window.api.getSearchResults(searchText, true, { fileNames: true });
```

The returned results are merged through:

- `enrichSearchSuggestions(...)`

## Quick suggestion rendering

Quick suggestions are rendered in `GlobalSearch.js` when:

- `quickSearchDropDown === true`

The dropdown can display:

- search history keywords
- recent searched videos
- matching playlists
- matching collections
- matching media files

It also shows typo-correction feedback when available:

```js
{
    correctedSearchText !== '' && (
        <div className={style.searchHints}>
            Showing results for: <strong>{correctedSearchText}</strong>
        </div>
    );
}
```

That `correctedSearchText` comes from backend search results returned by:

- `src/services/search/search.js`

## Full search flow in the UI

Full search is triggered from `GlobalSearch.js` by:

- pressing `Enter` with enough text and no selected suggestion
- clicking **View all results**
- selecting a suggestion keyword

This ultimately calls:

- `fullSearch(searchText)` in `useGlobalSearchAction.js`

### Full search behavior

`fullSearch(searchText)` does the following:

1. resets keyboard focus state
2. calls:

```js
window.api.getSearchResults(searchText, false);
```

3. when results return:
    - sends a renderer-to-main event to store search history:

```js
window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
    event: rendererEvents.SEARCH_HISTORY_ADD,
    searchText: searchText,
});
```

4. refreshes cached history via:
    - `window.api.getIndexedSearchHistory()`
    - `window.api.getSearchHistory()`

5. stores visible results in:

- `fullSearchResults`

Before storing, it applies:

- `checkForHiddenCollection(fullSearchResults)`

This removes hidden items when `applicationContext.hideHiddenCollections` is enabled.

## Full results panel rendering

When `showResultsPanel === true`, `GlobalSearch.js` renders:

- related search chips
- `SearchResults`

The results component receives:

- `searchResults={fullSearchResults}`
- `onSearchResultItemClick={onSearchResultItemClick}`
- `createPlaylist={createPlaylist}`
- `closeSearchResult={closeSearch}`

This is the main “view all search results” UI state.

## Search result click behavior

When a full-search file result is clicked, `GlobalSearch.js` calls:

- `onSearchResultItemClick(item)`

This forwards into:

- `onSeachResultsItemClick(item, searchText)` in `useGlobalSearchAction.js`

That function:

1. sends a main-process event to save selected-item search history:

```js
window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
    event: rendererEvents.SEARCH_HISTORY_ADD,
    selectedItem: item,
});
```

2. refreshes history
3. navigates depending on media type

### For video results

It calls:

- `window.api.getFullVideoDetails(item.id)`

Then dispatches:

- `applicationEvents.GOTO_COLLECTION`

with:

- the selected collection
- the selected video ID

### For image results

It calls:

- `window.api.getFullImageDetails(item.id)`

Then also dispatches:

- `applicationEvents.GOTO_COLLECTION`

with:

- the selected collection
- the selected media ID

## Quick result click behavior

Quick-search result clicks are handled by:

- `onQuickSearchResultItemClick(resultType, resultItem, searchText)`

Behavior depends on result type.

### `collection`

- finds the collection in `applicationContext.collections`
- dispatches `applicationEvents.GOTO_COLLECTION`

### `playlist`

- finds the playlist in `applicationContext.playlists`
- dispatches `applicationEvents.GOTO_PLAYLIST`

### `file`

- forwards into `onSeachResultsItemClick(...)`

### `searchedVideosHistory`

- finds the saved collection
- dispatches `applicationEvents.GOTO_COLLECTION`

## Search history updates from the UI

Search history is updated through renderer-to-main notifications sent on:

- `ipcChannels.NOTIFY_MAIN_PROCESS`

The relevant UI events sent from `useGlobalSearchAction.js` are:

- `rendererEvents.SEARCH_HISTORY_ADD`
- `rendererEvents.SEARCH_HISTORY_DELETE`
- `rendererEvents.ADD_MULTIPLE_VIDEOS_TO_PLAYLIST`

These are event-style notifications rather than direct invoke/response calls.

## Creating a playlist from search results

The UI supports creating a playlist from full search results through:

- `createAndViewInPlaylist(videoList, searchText)`

This function:

1. builds a playlist label like:
    - `Search - ${searchText.trim()}`
2. checks whether a playlist with that label already exists
3. if it exists:
    - dispatches `applicationEvents.PLAY_VIDEO_FROM_PLAYLIST`
4. if it does not exist:
    - calls `window.api.addNewPlaylist(newPlaylist)`
    - sends `rendererEvents.ADD_MULTIPLE_VIDEOS_TO_PLAYLIST`
    - dispatches `applicationEvents.PLAY_VIDEO_FROM_PLAYLIST`

This is a UI-driven action built on top of the search results state.

## Keyboard and focus behavior

`GlobalSearch.js` also manages keyboard-first search navigation.

Important behaviors include:

- `Escape`
    - closes quick search dropdown or full results panel
- arrow keys
    - navigate through suggestion items using `currentFocusPointer`
- `Enter`
    - activates focused suggestion
    - or starts full search when text length is sufficient
- `Tab`
    - closes the dropdown when the full results panel is not open

Focus targets are calculated in:

- `getQuickSuggestionsFocusKeys(...)`

This produces the keyboard navigation map used by the floating suggestion panel.

## End-to-end UI-to-backend summary

Search in the UI uses two layers:

### Local renderer-only search behavior

Used for:

- filtering playlists
- filtering collections
- combining local tags/history suggestions
- showing recent searched videos
- dropdown navigation and UI state

Main files:

- `src/ui/components/app-header/global-search/GlobalSearch.js`
- `src/ui/components/app-header/global-search/useGlobalSearchAction.js`

### Backend-assisted search behavior

Used for:

- matching file names
- matching titles
- matching tags
- matching metadata
- typo correction
- full result retrieval
- media-detail hydration

Main files:

- `src/main/api/searchApi.js`
- `src/services/ipc/handlers/search.handlers.js`
- `src/services/search/search.service.js`
- `src/services/search/search.js`

## Summary

The `GlobalSearch` UI is not just a thin input box. It combines:

- local suggestion building from in-memory application state
- debounced quick search
- backend-assisted search for media results
- full-search result retrieval
- search history persistence
- navigation to collections and playlists
- playlist creation from search output

The actual backend command path for media search remains:

```text
GlobalSearch UI
  → useGlobalSearchAction.js
  → window.api.getSearchResults(...)
  → src/main/api/searchApi.js
  → ipcRenderer.invoke(serviceMethods.SEARCH_GET_RESULTS, ...)
  → src/services/ipc/handlers/search.handlers.js
  → src/services/search/search.service.js
  → src/services/search/search.js
  → results returned to UI
```
