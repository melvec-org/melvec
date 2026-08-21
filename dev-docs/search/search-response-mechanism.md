# Search response mechanism

## How search works

Search is **multi-strategy**, not a single lookup.

A user query is handled in parallel through different match paths because different queries carry different kinds of intent.

### 1. Direct lexical search paths

The full query text is searched directly against:

- tags
- titles
- filenames

This is important because users may want literal text matches.

Example:

- searching `john in konark` should match a filename like `john in konark.mp4`
- that should work even if `john` is not recognized as a subject and `konark` is not recognized as a location

So these paths preserve straightforward text matching.

### 2. Planner-driven content search

Separately, the query is analyzed into:

- media type
- content type
- time
- location
- subject
- remaining descriptive words

The structured parts become constraints.

The leftover text becomes `remainingWords`.

This allows search to use:

- **candidate narrowing** from constraints like subject/location
- **metadata/description search** from the remaining free text

### 3. Candidate + metadata merge

Content search then combines two signals:

- candidate media from structured constraints
- metadata matches from `remainingWords`

Merge rule:

- if both have results -> intersect
- if only one has results -> use that one

So the system stays precise without becoming too brittle.

### 4. Post-search filtering

Some filters are applied after retrieval:

- time
- content type

These are better done after result collection because they rely on richer media details.

### 5. Segmented result response

Results are returned in separate buckets:

- `byTags`
- `byTitles`
- `byFileNames`
- `byContent`

This is intentional.

Why:

- different strategies capture different user intent
- lexical matches should not be lost just because planner extraction is weak
- the UI can explain why something matched
- each strategy can be tuned independently

### 6. Caching

Search results are cached to speed up repeated queries.

This matters because search may involve:

- planner analysis
- multiple retrieval strategies
- metadata lookup
- typo correction fallback
- result shaping

Caching makes quick search and repeated search much faster.

---

## Mental model

```text
Search =
  direct text matching
  + structured query understanding
  + metadata retrieval
  + post-filtering
  + segmented response
  + caching
```

## In one line

Search works by combining **literal text matching** and **structured query understanding**, then returning **grouped results** so each search strategy remains useful, explainable, and fast.
