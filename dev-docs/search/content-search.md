# Content search strategy

This document explains how content search works in the search service.

Primary implementation files:

- `src/services/search/search-planner/searchPlanner.js`
- `src/services/search/helpers/getMediaByContent.js`
- `src/services/search/helpers/getMediaBySearchCriteria.js`
- `src/services/search/search-planner/analyseMediaTypes.js`
- `src/services/search/search-planner/analyseContentTypes.js`
- `src/services/search/search-planner/analyseTime.js`
- `src/services/search/search-planner/analyseLocations.js`
- `src/services/search/search-planner/analyseSubjects.js`

---

## Overview

Content search is executed in two major parts:

1. **Search planner candidate search**
    - Parses the raw query
    - Extracts structured constraints
    - Leaves unmatched words as `remainingWords`
    - Builds a candidate media set from contextual constraints like location and subject

2. **Description / metadata search and filtering**
    - Searches metadata using `remainingWords`
    - Applies typo-correction fallback if metadata search returns no results
    - Merges context candidates with metadata matches
    - Applies post-search filters such as time and content type

---

## 1. Search planner candidate search

### Entry point

The search planner entry point is:

- `src/services/search/search-planner/searchPlanner.js`
- function: `analyseQuery(query)`

It builds a `queryPlanner` object with:

- `query`
- `constraints.mediaTypes`
- `constraints.subjects`
- `constraints.time`
- `constraints.locations`
- `constraints.contentTypes`
- `remainingWords`

### Planner pipeline

`analyseQuery()` runs analyzers in this order:

1. `analyseMediaTypes()`
2. `analyseContentType()`
3. `analyseTime()`
4. `analyseLocations()`
5. `analyseSubjects()`

Each analyzer:

- extracts one kind of constraint
- removes the matched words from `remainingWords`
- passes the reduced query to the next analyzer

### Planner flow diagram

```text
Raw query
   |
   v
analyseMediaTypes()
   |
   v
analyseContentType()
   |
   v
analyseTime()
   |
   v
analyseLocations()
   |
   v
analyseSubjects()
   |
   v
searchPlan
   |
   +--> constraints.mediaTypes
   +--> constraints.contentTypes
   +--> constraints.time
   +--> constraints.locations
   +--> constraints.subjects
   +--> remainingWords
```

### Example

Query:

```text
videos documentary in konark with neha last year
```

Possible planner output:

```js
{
  query: 'videos documentary in konark with neha last year',
  constraints: {
    mediaTypes: ['video'],
    contentTypes: ['documentaries'],
    time: { from: ..., to: ... },
    locations: ['konark'],
    subjects: ['neha']
  },
  remainingWords: 'in with'
}
```

Actual values depend on what the analyzers detect and what indexes contain.

---

## Candidate media set construction

After planning, candidate search begins in:

- `src/services/search/helpers/getMediaByContent.js`
- function: `buildCandidateMediaSet(constraints)`

### Inputs used for candidate search

`buildCandidateMediaSet()` currently builds candidates from:

- `constraints.locations` via `getMediaByLocations()`
- `constraints.subjects` via `getMediaBySubjects()`

### Candidate strategy

The function collects candidate sets and intersects them using:

- `intersectMedia(...arrays)`

This is a **strict intersection**.

That means:

- location matches AND subject matches -> return shared media only
- if one participating candidate set is empty -> result becomes empty

After intersection, it applies `constraints.mediaTypes` filtering if present.

### Candidate construction diagram

```text
constraints.locations ----> getMediaByLocations() --+
                                                     |
                                                     v
                                               intersectMedia()
                                                     |
                                                     v
constraints.subjects -----> getMediaBySubjects() ---+
                                                     |
                                                     v
                                      filter by constraints.mediaTypes
                                                     |
                                                     v
                                        candidateContextMediaIds
```

### Notes

- If both `locations` and `subjects` are empty, `buildCandidateMediaSet()` returns `[]`.
- `contentTypes` and `time` are **not** applied here.
- `contentTypes` and `time` are applied later in post-filtering.

---

## 2. Description / metadata search and filtering

### Entry point

The second stage is handled in:

- `src/services/search/helpers/getMediaByContent.js`
- function: `getMediaByContent(searchPlan, isQuickSearch)`

### Metadata search source

Metadata search is delegated to:

- `src/services/search/helpers/getMediaBySearchCriteria.js`
- function: `getMediaByMetaDataSearch(searchText, isQuickSearch, mediaTypeFilter)`

It searches metadata across media libraries and returns a flat array of normalized items:

- `{ id, mediaType, ... }`

### Metadata search behavior

`getMediaByContent()` first computes:

- `mediaTypeFilter` from `searchPlan.constraints.mediaTypes`
- `candidateContextMediaIds` from `buildCandidateMediaSet(searchPlan.constraints)`

Then it searches metadata using:

- `searchPlan.remainingWords`

```js
let mediaByMetaData = await getMediaByMetaDataSearch(searchPlan.remainingWords, isQuickSearch, mediaTypeFilter);
```

### Typo-correction fallback

If metadata search returns no results:

1. `ensureTypoCorrectionInitialized()` is called
2. `getCorrectedSearchText(searchPlan.remainingWords)` is computed
3. Metadata search is retried with corrected text

Relevant functions in `getMediaByContent.js`:

- `ensureTypoCorrectionInitialized()`
- `getCorrectedSearchText(searchText)`

### Metadata search diagram

```text
remainingWords
   |
   v
getMediaByMetaDataSearch()
   |
   v
results found?
   |
   +--> yes --> mediaByMetaData
   |
   +--> no --> ensureTypoCorrectionInitialized()
                  |
                  v
             getCorrectedSearchText()
                  |
                  v
            correctedText exists?
                  |
                  +--> yes --> retry getMediaByMetaDataSearch()
                  |
                  +--> no --> []
```

---

## Merging candidate search with metadata search

Once both sets are available, `getMediaByContent()` merges them.

### Current merge logic

In `src/services/search/helpers/getMediaByContent.js`, function `getMediaByContent()`:

- if both candidate results and metadata results have data -> intersect them
- if only candidate results have data -> use candidate results
- otherwise -> use metadata results

Conceptually:

```js
if (candidateContextMediaIds.length > 0 && mediaByMetaData.length > 0) {
    commonMedia = intersectMedia(candidateContextMediaIds, mediaByMetaData);
} else if (candidateContextMediaIds.length > 0) {
    commonMedia = candidateContextMediaIds;
} else {
    commonMedia = mediaByMetaData;
}
```

### Why this merge exists

This avoids losing strong context matches when metadata search is weak or empty.

Example:

- location/subject constraints produce valid candidate media
- `remainingWords` contains weak words or nothing useful for metadata
- metadata search returns `[]`
- result should still return context candidates instead of blank

### Merge diagram

```text
candidateContextMediaIds ----+
                              |
                              v
                       both non-empty?
                              |
        +---------------------+----------------------+
        |                                            |
       yes                                          no
        |                                            |
        v                                            v
 intersectMedia()                      candidateContextMediaIds non-empty?
                                                     |
                                  +------------------+------------------+
                                  |                                     |
                                 yes                                   no
                                  |                                     |
                                  v                                     v
                   use candidateContextMediaIds               use mediaByMetaData
```

---

## Post-search filtering

After merge, `getMediaByContent()` applies constraint filtering using:

- `applyConstraints(results, constraints)`

This currently supports:

- time filtering
- content type filtering

Relevant functions in `src/services/search/helpers/getMediaByContent.js`:

- `applyConstraints(results, constraints)`
- `filterByTime(list, timeConstraint)`
- `filterByContentTypes(list, contentTypes)`
- `populateMediaDetails(list)`

### Filtering behavior

`applyConstraints()` does the following:

1. if result set is empty, return `[]`
2. if time or content type filtering is needed, hydrate result items using `populateMediaDetails()`
3. apply time filtering if `constraints.time !== null`
4. apply content type filtering if `constraints.contentTypes.length > 0`
5. map the result back to lightweight objects:
    - `{ id, mediaType }`

### Filtering diagram

```text
commonMedia
   |
   v
empty?
   |
   +--> yes --> return []
   |
   +--> no --> time/contentType filter present?
                  |
                  +--> yes --> populateMediaDetails()
                  |
                  +--> no --> use current list
                               |
                               v
                         filterByTime()
                               |
                               v
                     filterByContentTypes()
                               |
                               v
                      map back to { id, mediaType }
```

---

## End-to-end flow

```text
User query
   |
   v
analyseQuery()
   |
   v
searchPlan { constraints, remainingWords }
   |
   +--> buildCandidateMediaSet()
   |
   +--> getMediaByMetaDataSearch(remainingWords)
             |
             v
        metadata empty?
             |
             +--> yes --> typo-correction retry
             |
             +--> no --> keep metadata results

candidate results + metadata results
   |
   v
merge in getMediaByContent()
   |
   v
applyConstraints()
   |
   v
final byContent results
```

---

## Important implementation notes

### 1. Candidate search is context-driven

Candidate media search is based on structured constraints, not free-text metadata.

Currently that means:

- locations
- subjects
- media types

### 2. Metadata search is driven by `remainingWords`

The planner removes recognized structural phrases first, then only the unmatched words are sent to metadata search.

This reduces noise and avoids searching metadata using words already consumed as constraints.

### 3. Candidate merge is intentionally not always strict

Candidate set construction is strict internally.

But final merge between candidate search and metadata search is more forgiving:

- both available -> intersect
- only one available -> adopt that one

This keeps the overall search usable when metadata terms are weak but structured constraints are strong.

### 4. Time and content types are post-filters

Time and content type checks are applied after merging candidate and metadata results.

This is important because these filters rely on hydrated media details.

---

## Related code references

### Planner

- `searchPlanner.js#analyseQuery`
- `analyseMediaTypes.js#analyseMediaTypes`
- `analyseContentTypes.js#analyseContentType`
- `analyseTime.js#analyseTime`
- `analyseLocations.js#analyseLocations`
- `analyseSubjects.js#analyseSubjects`

### Content search

- `getMediaByContent.js#getMediaByContent`
- `getMediaByContent.js#buildCandidateMediaSet`
- `getMediaByContent.js#intersectMedia`
- `getMediaByContent.js#applyConstraints`

### Metadata search

- `getMediaBySearchCriteria.js#getMediaByMetaDataSearch`

---

## Summary

The content-search pipeline works as follows:

1. Parse the user query into structured constraints plus `remainingWords`
2. Build a strict candidate set from contextual constraints
3. Search metadata using the reduced query
4. Retry metadata search with typo correction if needed
5. Merge candidate and metadata results
6. Apply time and content-type filters
7. Return lightweight content-search results

This gives the system two complementary strengths:

- **structured candidate narrowing** from planner-extracted constraints
- **free-text recall** from metadata/description search
