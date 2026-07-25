# Search service

This folder contains the core search engine (`search.js`), a UI-facing service wrapper (`search.service.js`), search-history integration (`searchHistory.js`), metadata search strategies (`getVideosByMetaData.js`, `getImagesByMetaData.js`), typo-correction (`typoCorrection.js`, `prepareTypoCorrectionVocabulary.js`), and utilities (`tagIndex.js`, `sortByOccurenceAndIndex.js`).

## Overview

The search flow is split into two layers:

- `search.js` performs the raw grouped search across **both videos and images** and returns lightweight result items tagged with a `mediaType`.
- `search.service.js` calls `search()` and then **hydrates** each result item for the UI — using full video details for videos and basic image details for images.

This follows the project architecture described in the repository README, where UI-facing service wrappers sit on top of lower-level service modules.

## `search.js`

`search.js` is the core grouped search engine for the application.

It is responsible for:

- searching across multiple sources for both videos and images
- grouping results by match type
- applying per-category limits
- calculating a combined `totalCount`
- caching search responses in memory
- clearing cache and rebuilding the typo-correction vocabulary when indexed data changes

### Internal helpers

| Helper | Purpose |
|---|---|
| `getMediaByTagSearch(keyword)` | Searches tags for both video and image IDs |
| `mediaByTitleSearch(keyword)` | Searches video and image titles |
| `getMediaByFileNameSearch(keyword)` | Searches video and image filenames |
| `getMediaByMetaDataSearch(searchText, isQuickSearch)` | Delegates to `getVideosByMetaData` and `getImagesByMetaData` |
| `getCorrectedSearchText(searchText)` | Returns a typo-corrected version of the query, or `null` |
| `ensureTypoCorrectionInitialized()` | Lazily loads the saved vocabulary and initializes the correction engine |
| `normalizeResultsByMediaType(items, mediaType)` | Stamps a `mediaType` field onto each result item |

## Search results

### Entry point

`search.service.js#getSearchResults(searchString, isQuickSearch, filters)` calls `search.js#search()` and then **hydrates** each result item:

- `mediaType === VIDEO` → `getFullVideoDetailsById(id)` from `videoLibrary.service.js`
- `mediaType === IMAGE` → `getBasicImageDetailsById(id)` from `imageLibrary.js`

Each hydrated item gets an additional field:

- `relevance`: the index within its category list (`0` = most relevant inside that category)

### Categories

`search()` returns results grouped into these categories:

- `byTags`: media (videos + images) matched via tag label substring match
- `byTitles`: media matched via title search
- `byFileNames`: media matched by filename
- `byMetaData`: media matched from metadata/description full-text search, with optional semantic reranking when AI is enabled

There is **no separate `bySemantic` category**. Semantic matching is applied as a reranking step inside `getVideosByMetaData` and `getImagesByMetaData` when AI is enabled, and the reranked results surface through `byMetaData`.

### Typical raw result shape

```js
{
  byTags:      [{ id: 'video-1', mediaType: 'video' }, { id: 'img-1', mediaType: 'image' }],
  byTitles:    [{ id: 'video-2', mediaType: 'video' }],
  byFileNames: [{ id: 'img-2',   mediaType: 'image' }],
  byMetaData:  [{ id: 'video-3', mediaType: 'video', score: 0.82 }],
  totalCount:  5,
  searchText:  'original query',
  correctedText: ''   // non-empty only when a typo correction was applied and produced results
}
```

### Notes on scoring

Not all categories use the same scoring model:

- `byTags`, `byTitles`, and `byFileNames` are match-list based (no score)
- `byMetaData` items carry a `score` from FTS or semantic reranking
- ordering is most meaningful **within a category**, not across categories

## Limits

Results are sliced **per category**, not globally.

- Quick search (`isQuickSearch = true`): `3` results per category; `5` for metadata
- Full search (`isQuickSearch = false`): `MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY` results per category from `configs/appConfig`

`totalCount` is computed from the raw pre-slice totals across all four categories.

## Filters

`search.service.js#getSearchResults(searchString, isQuickSearch, filters)` accepts `filters` (default: `{ fileNames: true, tags: true }`).

These are passed through to `search()` for narrowing results. Keep filtering logic close to the service/search boundary so the grouped response shape remains predictable.

## Typo correction

When a metadata search returns zero results, `search.js` attempts to correct the query using the typo-correction engine before retrying.

The corrected query is stored in `correctedText` on the result object (non-empty only when a correction was applied and produced results).

### `typoCorrection.js`

Stateful in-memory typo-correction engine based on trigram indexing and edit-distance scoring.

**Key exports:**

| Function | Description |
|---|---|
| `initializeTypoCorrection(terms, options?)` | Builds the trigram index from a prepared vocabulary. Returns `{ totalTerms, totalTrigrams }` |
| `invalidateTypoCorrectionIndex()` | Resets the engine to its uninitialized state |
| `isTypoCorrectionInitialized()` | Returns `true` if the engine is ready |
| `getCorrectionForToken(token)` | Returns the best matching vocabulary term, or `null` |
| `normalizeTerm(term)` | Lowercases, trims, and replaces punctuation |
| `tokenizeText(text, options?)` | Splits text into filtered vocabulary tokens |
| `prepareVocabularyTerms(terms, options?)` | Deduplicates and filters a raw term list |
| `getTrigrams(term)` | Returns unique padded trigrams for a term |
| `buildTrigramIndex(terms)` | Builds a `Map<trigram, termId[]>` index |
| `getCandidateTermIds(token)` | Returns term IDs ranked by trigram overlap |

**Thresholds:**

- `minCandidateOverlapCount`: `2` trigrams required before a candidate is considered
- `minCorrectionScore`: `0.65` normalized edit-distance score required to accept a correction
- `minTokenLength` (default `5`): tokens shorter than this are not corrected

### `prepareTypoCorrectionVocabulary.js`

Builds and persists the vocabulary used by the typo-correction engine.

**Vocabulary sources** (via `prepareTypoCorrectionVocabularyFromDb`):

- video titles and metadata descriptions
- image titles and descriptions
- tag labels
- playlist labels

**Key exports:**

| Function | Description |
|---|---|
| `prepareTypoCorrectionVocabularyFromDb(options?)` | Builds vocabulary from all DB sources |
| `rebuildAndSaveTypoCorrectionVocabulary(options?)` | Rebuilds, saves to DB, and clears memory cache |
| `getSavedTypoCorrectionVocabulary()` | Loads vocabulary from DB (memory-cached) |
| `prepareTypoCorrectionVocabulary(texts, options?)` | Builds vocabulary from an arbitrary text array |
| `extractSearchableTextsFromVideo(videoId)` | Extracts title + description for one video |
| `extractSearchableTextsFromImage(imageId)` | Extracts title + description for one image |
| `addTextsToVocabulary(vocabulary, texts, options?)` | Adds tokenized terms from texts into a vocabulary Set |
| `clearPreparedTypoCorrectionVocabularyCache()` | Clears the in-memory vocabulary cache |

## `getVideosByMetaData.js`

Handles metadata search for **videos** using a tiered FTS + semantic strategy.

### Strategy

| Mode | Keyword count | Behavior |
|---|---|---|
| AI disabled | any | Strict FTS only |
| Quick search, AI enabled | 1–3 terms | Strict FTS only |
| Quick search, AI enabled | 4+ terms | Strict FTS → expand with loose FTS if < 5 candidates → semantic rerank |
| Full search, AI enabled | 1 term | Strict FTS only |
| Full search, AI enabled | 2+ terms | Strict FTS → expand with loose FTS if < 5 candidates → semantic rerank |

Semantic reranking uses `getSemanticMatches.js` with the FTS candidate IDs as the candidate set. Falls back to lexical candidates if semantic reranking returns no results.

**Exported:** `getVideosByMetaData(keywords, isQuickSearch)`

## `getImagesByMetaData.js`

Handles metadata search for **images** using the same tiered strategy as videos but backed by image-specific DB functions.

FTS functions: `searchImagesByDescription`, `searchImagesLooseByDescription`  
Semantic reranking: uses `getEmbeddingByImageId` + `cosineSimilarityVector` directly (not via `getSemanticMatches.js`).

Result items include an extra `descMatch` field (snippet from the FTS match, or `null`).

**Exported:** `getImagesByMetaData(keywords, isQuickSearch)`

## Caching

Search results are cached in an in-memory `LRUCache`.

The cache size is controlled by `MAX_SEARCH_RESULTS_CACHE_COUNT` from `configs/appConfig`.

### Cache key

```text
${searchText.toLowerCase()}_${isQuickSearch}
```

### Cached value shape

The full grouped result object from `search()` is cached as-is. A cached hit is flagged with `isCached: true` so `search.service.js` skips re-hydration.

## Cache invalidation

`search.js#initSearch()` subscribes to the inter-service event bus:

- **`interServiceEvents.INDEX_DATA_CHANGED`** → clears the results cache
  - If `data.change` is `'titleChange'` or `'metaDataChange'`, also calls `rebuildAndSaveTypoCorrectionVocabulary()` and `invalidateTypoCorrectionIndex()`

Any update to titles, tags, metadata, embeddings, or filenames should trigger this event.

## Search history

`searchHistory.js` integrates with the database-backed search history and the video action history.

### Responsibilities

- persist searched keywords via `searchHistoryDbService.addToSearchHistory(keyword)`
- track selected **video** IDs via `actionHistory.addToSearchedVideos(selectedItem.id)` — image selections are not currently tracked in action history

### Service wrapper

`search.service.js` exposes:

- `initSearchService()` – initializes both the search history DB service and the search engine
- `getSearchResults(searchString, isQuickSearch, filters)`
- `addToSearchHistoryService({ searchText, selectedItem })`
- `deleteSearchHistoryItemService({ searchText })`
- `clearSearchHistoryService()` – returns UI-friendly success/failure responses
- `getSearchHistoryService(limit = 5)` – returns:
  - `searchedKeys`: recent keyword searches
  - `searchedVideos`: recent searched video details resolved from stored IDs
- `getIndexedSearchHistory()` – returns keyword history sorted by occurrence and time from the DB

## `tagIndex.js`

A lightweight in-memory dictionary that indexes tags by their first letter for quick lookup.

**Exports:** `prepareTagsDict(tags)`, `getTagsByFirstLetter(firstLetter)`

> Note: this module uses an `export default` syntax inconsistent with the rest of the service layer (which uses `module.exports`). It is not currently consumed by `search.js`, which performs its own tag filtering via `getTags()` directly.

## `sortByOccurenceAndIndex.js`

A utility function used by the search-history layer.

`sortByOccurenceAndIndex(arr)` — given an array of keyword strings (possibly with duplicates), returns a deduplicated array sorted descending by occurrence count, then by latest index position.

Used internally by `getSearchHistoryByOccurenceAndTime` to rank frequently and recently used search terms.

## Maintenance notes

When updating this module, keep these behaviors aligned:

- every result item must carry a `mediaType` field (`'video'` or `'image'`) before being returned from `search()`
- grouped result keys (`byTags`, `byTitles`, `byFileNames`, `byMetaData`) must remain stable for the UI
- quick search and full search must apply limits consistently
- cache invalidation must happen whenever indexed/searchable data changes; typo-correction vocabulary must be rebuilt on title or metadata changes
- semantic reranking lives inside `getVideosByMetaData` and `getImagesByMetaData` — do not add a separate `bySemantic` category to the grouped result
- hydration must remain in `search.service.js`, not in `search.js`

This keeps the search layer predictable and consistent with the repository's service-oriented architecture.
