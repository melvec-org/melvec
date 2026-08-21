# Melvec Location Architecture (V1)

## Goals

- Fully offline.
- No dependency on reverse geocoding services.
- Fast import-time location resolution.
- Support both reference locations (cities) and user-defined
  locations.
- Keep runtime memory low by loading reference data only during
  import.

## Components

### locationReference.js

Responsible only for reference data.

Responsibilities: - Load/unload reference dataset. - Spatial lookup. -
Find best matching reference location from latitude/longitude. -
Return: - referenceId - city - administrativeName - country -
centerLat - centerLon - radius

It never accesses SQLite.

### locationService.js

Responsible for persistent clusters and media assignments.

Responsibilities: - Find/create reference-backed clusters. - Manage
custom clusters. - Assign media to clusters. - Rename clusters. - Update
aliases. - Update custom cluster geometry. - Search clusters.

## Reference Dataset

Stored as pre-built spatial JSON.

Characteristics: - Loaded only during import/scanning. - Unloaded
afterwards. - Indexed by spatial buckets. - Contains: - referenceId -
name - administrative name - country - latitude - longitude - population
(or precomputed radius)

## Resolution Flow

1. Extract GPS.
2. Search existing location clusters first.
3. If GPS falls inside an existing cluster radius:
    - Use that cluster.
4. Otherwise:
    - Query `locationReference.js`.
    - Resolve the nearest **POI**.
    - If no POI matches, resolve the nearest **City**.
    - Find cluster by `referenceId`.
    - Create the cluster if it does not exist.
    - Assign the media to the cluster.

Custom clusters always take precedence over reference datasets. POIs take precedence over cities, providing users with more meaningful location names whenever possible.

---

## Location Resolution Flow

```text
                           +----------------------+
                           |      Media GPS       |
                           +----------+-----------+
                                      |
                                      v
                    +-------------------------------+
                    | Search Existing Location      |
                    | Clusters (Custom + Reference) |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    | Is GPS inside an existing     |
                    | cluster radius?               |
                    +-----------+-------------------+
                                |
                  +-------------+-------------+
                  |                           |
                 YES                         NO
                  |                           |
                  v                           v
      +----------------------+     +-------------------------+
      | Assign Existing      |     | locationReference.js    |
      | Cluster              |     | Resolve Reference       |
      +----------+-----------+     +-----------+-------------+
                 |                             |
                 |                             v
                 |              +------------------------------+
                 |              | Search POI Reference Dataset |
                 |              +--------------+---------------+
                 |                             |
                 |                  +----------+----------+
                 |                  |                     |
                 |                Match               No Match
                 |                  |                     |
                 |                  v                     v
                 |       +------------------+   +---------------------+
                 |       | Return POI       |   | Search City         |
                 |       | Reference        |   | Reference Dataset   |
                 |       +--------+---------+   +----------+----------+
                 |                  |                       |
                 |                  +-----------+-----------+
                 |                              |
                 |                              v
                 |                +----------------------------+
                 |                | Returns                    |
                 |                | - referenceId              |
                 |                | - name                     |
                 |                | - type                     |
                 |                | - city                     |
                 |                | - state                    |
                 |                | - country                  |
                 |                | - centerLat                |
                 |                | - centerLng                |
                 |                | - radius                   |
                 |                +------------+---------------+
                 |                             |
                 |                             v
                 |                +----------------------------+
                 |                | Find Cluster using         |
                 |                | referenceId                |
                 |                +------------+---------------+
                 |                             |
                 |                  +----------+----------+
                 |                  |                     |
                 |                Found             Not Found
                 |                  |                     |
                 |                  v                     v
                 |        +------------------+   +------------------+
                 |        | Use Existing     |   | Create Reference |
                 |        | Cluster          |   | Cluster          |
                 |        +--------+---------+   +--------+---------+
                 |                  \               /
                 |                   \             /
                 +--------------------\-----------/
                                       |
                                       v
                        +-------------------------------+
                        | Save locationClusterId        |
                        | to Media                      |
                        +-------------------------------+
```

## Database

### location_clusters

- id
- referenceId (nullable)
- name
- aliases (JSON)
- centerLat
- centerLon
- radius

referenceId is NULL for custom locations.

### media

Stores: - latitude - longitude - locationClusterId

Only one location cluster per media in V1.

## Why GPS is stored

Keeping latitude/longitude enables: - future resolver improvements -
rebuilding clusters - creating custom clusters later - avoiding repeated
EXIF parsing

## Why referenceId exists

Users may rename locations.

Example:

Delhi -\> New Delhi

Reference dataset still returns Delhi.

Matching by referenceId guarantees future imports reuse the same
cluster.

## Why aliases are stored

Allows search terms such as: - Bombay -\> Mumbai - Bangalore -\>
Bengaluru - User-defined nicknames

Aliases are stored as a JSON array because cluster counts are expected
to be small.

## Radius

Radius has two purposes:

Reference-backed clusters: - cache previously resolved locations - avoid
repeated reference lookups

Custom clusters: - define user-created geographic areas - default
radius: 500 m - user adjustable

## Architectural Decisions

- Offline-first.
- Reference data separated from user database.
- Reference JSON is immutable.
- Cluster table represents the user's location knowledge.
- Search existing clusters before consulting reference data.
- One media belongs to one location cluster in V1.
- Merge/split clusters deferred to V2.
- Spatial index precomputed in JSON to avoid runtime indexing.
- Runtime loads reference data only during import.

## Future (V2)

- Cluster merge/split.
- Better spatial indexing.
- Smarter landmark resolution.
- AI-assisted custom cluster suggestions.
