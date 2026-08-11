# World Cities Reference Data

This directory contains the processed **World Cities Reference Dataset** used by Melvec's offline location resolver.

The dataset converts GPS coordinates into human-readable locations (City, State/Province, Country) without requiring an online reverse-geocoding service.

The generation pipeline consists of two stages:

```
SimpleMaps CSV
      |
      v
City Normalization
      |
      v
cities.normalized.json
      |
      v
Geo Spatial Reference Builder
      |
      v
geoSpatialReference.json
```

---

# Source

The original city data is provided by **SimpleMaps**.

Official website:

https://simplemaps.com/data/world-cities

The original CSV file is not included in this repository.

It should be downloaded directly from SimpleMaps when regenerating the dataset.

---

# Repository Structure

```
location-data/

├── README.md
│
├── convert-cities.js
├── buildGeoSpatialReference.js
│
├── cities.normalized.json
└── geoSpatialReference.json
```

---

# Data Generation Pipeline

## Step 1: Download Source Data

Download the latest free SimpleMaps World Cities Database:

https://simplemaps.com/data/world-cities

Place the downloaded file:

```
worldcities.csv
```

in the working directory.

The CSV file should not be committed.

---

## Step 2: Convert and Normalize Cities

Run:

```bash
node convert-cities.js
```

This creates:

```
cities.normalized.json
```

The normalized dataset is a clean intermediate representation.

---

## Step 3: Build Geo Spatial Reference

Run:

```bash
node buildGeoSpatialReference.js
```

This creates:

```
geoSpatialReference.json
```

The generated file contains the optimized spatial lookup structure used by Melvec.

---

# Normalization Rules

During conversion:

- `city_ascii` → `city`
- `admin_name` → `adm`
- `population` → `pop`
- `country` → `cty`
- `lat` and `lng` rounded to 4 decimal places
- Country names normalized:
    - United States → USA
    - United Kingdom → UK
    - United Arab Emirates → UAE
- `adm` removed when it is identical to the city name
- Original SimpleMaps `id` retained

---

# Normalized City Format

Example:

```json
{
    "id": 1356226629,
    "city": "Mumbai",
    "lat": 19.0758,
    "lng": 72.8775,
    "cty": "India",
    "adm": "Maharashtra",
    "pop": 24973000
}
```

Fields:

| Field | Description                    |
| ----- | ------------------------------ |
| id    | Original SimpleMaps identifier |
| city  | ASCII city name                |
| lat   | Latitude                       |
| lng   | Longitude                      |
| cty   | Country                        |
| adm   | Administrative region          |
| pop   | Population                     |

---

# Geo Spatial Reference

`geoSpatialReference.json` is the runtime lookup file.

Melvec loads this file into memory for location resolution.

Runtime flow:

```
GPS Coordinate
        |
        v
Geo Spatial Index Lookup
        |
        v
Candidate Cities
        |
        v
Distance Calculation
        |
        v
Nearest City Result
```

The file is loaded once when required and released after processing.

There is no requirement for multiple geo files or persistent tile loading.

---

# Design Considerations

The intermediate JSON is intentionally readable.

Benefits:

- Easy debugging
- Easy validation
- Easy regeneration
- Allows changing the geo indexing strategy
- Keeps data preparation separate from runtime optimization

The final `geoSpatialReference.json` may use a more optimized internal structure because it is a generated runtime artifact.

---

# Attribution

This project uses derived data generated from:

**SimpleMaps World Cities Database**

https://simplemaps.com/data/world-cities

Copyright © SimpleMaps.

---

# License Notice

The original city dataset is not owned by this project.

This repository contains a transformed representation of the SimpleMaps dataset. Ownership, copyright, and licensing terms of the original data remain with SimpleMaps.

Users are responsible for complying with the current SimpleMaps license and usage terms when downloading, regenerating, or redistributing the source dataset.

Please refer to the official SimpleMaps website for current licensing information.
