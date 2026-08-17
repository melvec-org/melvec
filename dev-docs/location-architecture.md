# Melvec Location Resolution Architecture

## Overview

Melvec uses a GPS-first location resolution pipeline for imported photos
and videos.

The goal is simple:

> Given the GPS coordinates embedded in media, determine the most
> meaningful location Melvec can recognize and associate with the media.

The system uses two reference datasets:

1.  **Curated Points of Interest (POI)** --- manually maintained
    destinations and landmarks.
2.  **Cities** --- a broad geographic reference dataset used when a
    specific POI is not recognized.

The resolved location is then connected to Melvec's existing
location-cluster system.

The overall flow is:

```text
Media
  |
  v
GPS Extraction
  |
  v
Location Resolver
  |
  +--------------------+
  |                    |
  v                    v
POI Spatial Index   City Spatial Index
  |                    |
  +---------+----------+
            |
            v
     Resolved Location
            |
            v
     Existing Cluster?
        /       \
      Yes        No
       |          |
       |          v
       |      Create Cluster
       |          |
       +----------+
            |
            v
      Assign Media
```

---

# 1. Design Goals

The location system is designed around the following principles:

- Keep the runtime lookup fast.
- Avoid searching the entire reference dataset for every media item.
- Recognize important tourist destinations, not just cities.
- Allow custom/user-created location clusters to take precedence.
- Keep POI and city reference data independent.
- Return complete reference information from the resolver.
- Keep display formatting separate from geographic resolution.
- Keep the reference datasets easy for developers to maintain.
- Avoid unnecessary metadata such as aliases and keywords.
- Support the system offline as part of Melvec's offline-first
  architecture.

---

# 2. Media GPS Extraction

Location resolution starts with GPS extraction.

Currently the scope is:

```text
Image  -> GPS extraction
Video  -> GPS extraction
Audio  -> skipped
```

Audio files are intentionally excluded because GPS metadata is uncommon
in ordinary audio and the product value does not currently justify a
separate extraction path.

The rest of the location system does not depend on the media type.

The extractor should expose a simple interface:

```javascript
const gps = await extractGPSData(mediaPath, mediaType);
```

Returning:

```javascript
{
    latitude: 13.6833,
    longitude: 79.3470
}
```

or:

```javascript
null;
```

The GPS extraction implementation can use different metadata mechanisms
internally for different media types. For example, `ffprobe` can be used
for video metadata, while image EXIF may require an EXIF-specific reader
depending on the metadata exposed by the image.

This keeps metadata extraction separate from location resolution.

---

# 3. Location Resolution

GPS coordinates are passed to:

```javascript
findLocation(latitude, longitude);
```

The resolver determines whether the coordinates correspond to a known
reference location.

The resolution priority is:

```text
Existing Location Cluster
        |
        | no match
        v
Curated POI
        |
        | no match
        v
City
        |
        | no match
        v
No reference location
```

However, the existing cluster check is performed before reference lookup
because custom/user-created clusters must always take precedence.

---

# 4. Existing Location Clusters Have Priority

Melvec may already have a location cluster created from previously
imported media or manually created by the user.

Therefore the first question is:

> Does this GPS coordinate already fall inside an existing location
> cluster?

If yes, the existing cluster is used.

This prevents a generic reference location from overriding a more
meaningful user-defined location.

For example:

```text
User-created cluster:
"Grandma's House"
```

must take precedence over:

```text
City:
Bengaluru
```

even though the coordinates are geographically inside Bengaluru.

The cluster system therefore remains the final authority for media
assignment.

---

# 5. Curated POI Dataset

The curated POI dataset contains manually selected, highly visited or
highly recognizable destinations.

The dataset will initially focus on countries with significant
international and domestic tourism.

Priority:

```text
India
USA

Japan
France
Italy

Spain
Germany
Thailand
Turkey

South Africa
Kenya
Tanzania
Morocco
Egypt
```

The dataset is expected to grow gradually, potentially reaching
approximately 10,000--20,000 curated destinations.

The POI dataset is intentionally simple.

It does not contain:

- aliases
- keywords
- search synonyms
- large descriptive metadata
- user-generated tags

The primary purpose is geographic recognition:

> "We recognize the coordinates of this media as this destination."

---

# 6. POI Data Structure

A POI record follows this structure:

```json
{
    "id": "IND-RLG-00001",
    "name": "Tirupati Balaji",
    "category": "Religious",
    "type": "Temple",
    "city": "Tirupati",
    "admin": "Andhra Pradesh",
    "country": "India",
    "lat": 13.6833,
    "lng": 79.347,
    "radius": 2500
}
```

### Fields

Field Description

---

`id` Stable POI identifier
`name` Human-readable destination name
`category` Broad POI category
`type` Specific POI type
`city` City containing the POI
`admin` First-level administrative area
`country` Full country name
`lat` POI center latitude
`lng` POI center longitude
`radius` Recognition radius in meters

`admin` is used instead of `state` as the standard field because
different countries use different administrative terminology.

An optional `state` field may still exist where Indian-specific source
data requires it.

---

# 7. POI Categories

The initial category set is:

Category Code

---

Religious `RLG`
Historical `HIS`
Natural Beauty `NAT`
Wildlife & Nature `WLD`
Entertainment `ENT`
Cultural & Lifestyle `CUL`
Adventure `ADV`
Iconic Experiences `ICO`
Urban Attractions `URB`

The category is stored as the readable value in the POI record.

The short category code is primarily used in the POI identifier.

---

# 8. POI Identifier

The POI ID follows:

```text
<ISO_ALPHA3_COUNTRY>-<CATEGORY_CODE>-<SEQUENCE>
```

Examples:

```text
IND-RLG-00001
IND-HIS-00001
USA-ICO-00001
JPN-ICO-00001
FRA-HIS-00001
```

Country codes use ISO 3166-1 Alpha-3 codes.

Examples:

```text
India         IND
United States USA
Japan         JPN
France        FRA
Italy         ITA
Spain         ESP
Germany       DEU
Thailand      THA
Turkey        TUR
South Africa  ZAF
Kenya         KEN
Tanzania      TZA
Morocco       MAR
Egypt         EGY
```

The full country name remains in the POI record.

---

# 9. City Reference Dataset

The city dataset provides broad geographic coverage.

It is different from the curated POI dataset.

The city dataset:

- contains a large number of cities
- is generated from normalized city data
- is not manually curated at the same level as POIs
- provides fallback geographic recognition
- has a radius associated with each city

Conceptually:

```text
POI = precise, curated recognition

City = broad geographic fallback
```

For example, GPS at the Taj Mahal should ideally resolve to:

```text
Taj Mahal, Agra, Uttar Pradesh, India
```

rather than only:

```text
Agra, Uttar Pradesh, India
```

If the coordinates are elsewhere in Agra and do not fall inside the Taj
Mahal POI radius, the city reference can resolve them to Agra.

---

# 10. Separate Spatial Indexes

POI and city data have different characteristics, so they use
independent spatial indexes.

Recommended structure:

```text
resources/
└── locations/
    ├── cities/
    │   ├── cities.normalized.json
    │   └── geoSpatialReference.json
    │
    └── poi/
        ├── poi.normalized.json
        └── poiGeoSpatialReference.json
```

This separation provides:

- independent build processes
- independent updates
- simpler debugging
- smaller lookup structures
- clearer ownership of reference data
- easier future scaling

There is no need to combine the city and POI indexes into one large
file.

---

# 11. Geo-Spatial Bucket Index

The spatial indexes divide the world into geographic buckets.

The current bucket size is:

```javascript
const BUCKET_SIZE = 0.25;
```

This creates a grid of:

```text
0.25° latitude x 0.25° longitude
```

A coordinate is converted into a bucket:

```javascript
const latBucket = Math.floor(latitude / BUCKET_SIZE);
const lngBucket = Math.floor(longitude / BUCKET_SIZE);
```

The resulting values form a bucket key:

```text
54:317
```

For example:

```text
Latitude  13.6833 -> bucket 54
Longitude 79.3470 -> bucket 317
```

The purpose is to avoid searching the complete dataset.

Instead of:

```text
GPS -> search 20,000 POIs
```

the lookup becomes:

```text
GPS
 |
 v
Calculate bucket
 |
 v
Read current + neighboring buckets
 |
 v
Search only a small candidate set
```

---

# 12. Neighboring Buckets

A coordinate close to a bucket boundary may have a matching POI in an
adjacent bucket.

Therefore the resolver searches:

```text
+-----+-----+-----+
| -1  |  0  | +1  |
+-----+-----+-----+
| -1  | GPS | +1  |
+-----+-----+-----+
| -1  |  0  | +1  |
+-----+-----+-----+
```

In other words, the current bucket and its eight neighboring buckets.

This prevents bucket boundaries from affecting geographic recognition.

---

# 13. Distance Calculation

The resolver uses two stages.

## Stage 1: Bounding Box

A cheap geographic bounding-box calculation is performed first.

Its purpose is to quickly eliminate candidates that are obviously
outside the POI/city radius.

```text
Candidate
   |
   v
Bounding box?
   |
   +-- No --> discard
   |
   +-- Yes
          |
          v
      Haversine
```

This avoids performing expensive trigonometric calculations for every
candidate.

## Stage 2: Haversine

The Haversine formula calculates the actual great-circle distance
between the media GPS coordinate and the reference center.

The candidate is considered a match when:

```text
distance <= reference.radius
```

If multiple reference locations match, the nearest matching location is
selected.

---

# 14. Reference Resolver

The runtime resolver should remain focused on geographic lookup.

Conceptually:

```javascript
findLocation(latitude, longitude);
```

performs:

```text
1. Load reference data if necessary.
2. Find candidate locations from the spatial index.
3. Apply bounding-box filtering.
4. Calculate exact Haversine distances.
5. Select the nearest matching location.
6. Return the complete reference record.
```

The resolver should not format the final display string.

It should return the complete reference object.

For example:

```json
{
    "id": "IND-RLG-00001",
    "name": "Tirupati Balaji",
    "category": "Religious",
    "type": "Temple",
    "city": "Tirupati",
    "admin": "Andhra Pradesh",
    "country": "India",
    "lat": 13.6833,
    "lng": 79.347,
    "radius": 2500
}
```

Returning the complete record preserves information for future features.

---

# 15. Location Formatting

Location formatting is intentionally separate from geographic
resolution.

Recommended utility:

```javascript
formatLocation(location);
```

The formatter constructs the human-readable location from:

```text
name
city
admin
state
country
```

and removes duplicates.

For example:

```text
Tirupati Balaji
Tirupati
Andhra Pradesh
India
```

becomes:

```text
Tirupati Balaji, Tirupati, Andhra Pradesh, India
```

If values are duplicated:

```text
Tokyo
Tokyo
Tokyo
Japan
```

the formatter produces:

```text
Tokyo, Japan
```

The current implementation uses a case-insensitive `Map` to remove
duplicate values while preserving the original display value.

This logic belongs in:

```text
locationFormatter.js
```

and not in the geo-spatial resolver.

---

# 16. Why Formatting Is Separate

Geographic resolution answers:

> What reference location is this coordinate associated with?

Formatting answers:

> How should that location be presented?

Keeping these responsibilities separate allows future display formats
without changing the resolution engine.

For example:

```text
Full:
Tirupati Balaji, Tirupati, Andhra Pradesh, India

Short:
Tirupati Balaji, India

City:
Tirupati, Andhra Pradesh, India
```

The underlying resolved reference remains unchanged.

---

# 17. Reference Data Build Pipeline

Reference data is generated ahead of runtime.

Conceptually:

```text
Source Data
    |
    v
Normalize
    |
    v
Reference JSON
    |
    v
Build Spatial Index
    |
    v
Runtime Spatial Reference
```

For cities:

```text
cities source
    |
    v
cities.normalized.json
    |
    v
geoSpatialReference.json
```

For POIs:

```text
curated POI data
    |
    v
poi.normalized.json
    |
    v
poiGeoSpatialReference.json
```

The runtime resolver should not perform normalization, radius
calculation, or spatial-index construction.

Those are build-time responsibilities.

---

# 18. Radius

The radius is part of the reference record.

For POIs, the radius is curated according to the physical extent and
recognition intent of the destination.

Example:

```json
{
    "name": "Tirupati Balaji",
    "lat": 13.6833,
    "lng": 79.347,
    "radius": 2500
}
```

For cities, the radius can be generated during the city-reference build
process.

Runtime code should simply consume the stored radius.

It should not call:

```javascript
calculateRadius();
```

during media import.

---

# 19. Data Normalization

Data normalization belongs to the reference build process.

This includes:

- standardizing field names
- normalizing city/admin/country values
- generating IDs
- assigning category/type values
- calculating or assigning radius
- building the spatial index

Runtime location resolution should not modify reference data.

This keeps media import fast and deterministic.

---

# 20. Overall Runtime Flow

The complete media import location flow is:

```text
                    +----------------+
                    |     Media      |
                    +-------+--------+
                            |
                            v
                    +---------------+
                    | Extract GPS   |
                    +-------+-------+
                            |
                      GPS found?
                       /       \
                     No         Yes
                     |           |
                     v           v
                  Skip GPS   Existing
                             Cluster?
                            /        \
                          Yes         No
                           |           |
                           v           v
                    Use Existing   POI Lookup
                      Cluster           |
                                       |
                                  Match found?
                                   /       \
                                 Yes        No
                                  |          |
                                  v          v
                              POI Result   City Lookup
                                               |
                                               v
                                         Match found?
                                          /       \
                                        Yes        No
                                         |          |
                                         v          v
                                    City Result   No Location
                                         |
                                         v
                                  Find Cluster
                                  by referenceId
                                    /      \
                                  Found    Missing
                                   |          |
                                   |          v
                                   |      Create Cluster
                                   |          |
                                   +----------+
                                        |
                                        v
                                  Assign Media
```

---

# 21. Separation of Responsibilities

The architecture intentionally separates responsibilities:

```text
GPS Extraction
    |
    +-- image metadata / EXIF
    +-- video metadata / ffprobe
    |
    v
Location Resolution
    |
    +-- existing cluster
    +-- POI spatial index
    +-- city spatial index
    |
    v
Location Formatting
    |
    v
Human-readable location
```

### GPS extractor

Answers:

> What coordinates are embedded in this media?

### Location resolver

Answers:

> What known geographic reference does this coordinate represent?

### Cluster manager

Answers:

> Which Melvec location cluster should own this media?

### Location formatter

Answers:

> How should the location be displayed?

This separation keeps each component small and replaceable.

---

# 22. Expected Result

For a photo or video containing GPS coordinates near Tirupati Balaji:

```text
GPS
13.6833, 79.3470
        |
        v
POI lookup
        |
        v
Tirupati Balaji
        |
        v
Location Cluster
        |
        v
Media
```

The user-facing location can be:

```text
Tirupati Balaji, Tirupati, Andhra Pradesh, India
```

If the GPS is somewhere else within Tirupati but outside the POI radius:

```text
GPS
        |
        v
POI lookup -> no match
        |
        v
City lookup
        |
        v
Tirupati, Andhra Pradesh, India
```

This provides a useful balance between **specific recognition** and
**broad geographic coverage**.

---

# 23. Architectural Rationale

The design deliberately avoids trying to build a general-purpose
geocoder.

Melvec does not need to resolve:

```text
street
building number
neighborhood
postal address
```

from every coordinate.

The objective is different:

> Recognize meaningful locations in a personal media library.

Therefore:

```text
Curated POI
     >
City
     >
No known reference
```

is more useful for Melvec than a massive address database.

The curated POI layer provides the semantic recognition users care
about, while the city dataset provides broad fallback coverage.

The spatial index provides the performance required for large media
libraries without requiring a heavyweight geographic database.

---

# 24. Future Expansion

The architecture leaves room for future additions without changing the
core resolver.

Possible future reference types could include:

```text
POI
City
Airport
Beach
National Park
Custom Location
```

Each can have its own reference dataset and spatial index if needed.

The runtime interface can remain:

```javascript
findLocation(latitude, longitude);
```

The cluster system can remain independent of the underlying reference
source.

The most important architectural constraint is to keep:

```text
reference data
spatial index
runtime resolver
cluster management
display formatting
```

as separate concerns.

---

# 25. Summary

Melvec's location architecture is based on five simple ideas:

1.  **Extract GPS when it exists.**
2.  **Custom/existing clusters always take precedence.**
3.  **Use curated POIs for meaningful destination recognition.**
4.  **Use cities as broad geographic fallback.**
5.  **Use spatial indexes and radius checks to keep lookup fast.**

The result is a lightweight, offline-friendly geographic recognition
system designed specifically for a medium to large scale media library rather than a
general-purpose mapping application.
