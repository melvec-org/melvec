const fs = require('fs');
const path = require('path');

const CITIES_INPUT_FILE = path.join(__dirname, './cities/cities.normalized.json');
const CITIES_OUTPUT_FILE = path.join(__dirname, './cities/geoSpatialReference.json');

const POI_INPUT_FILE = path.join(__dirname, './poi/poi.normalized.json');
const POI_OUTPUT_FILE = path.join(__dirname, './poi/geoSpatialReference.json');

const BUCKET_SIZE = 0.25;

function getBucketKey(lat, lng) {
    const latBucket = Math.floor(lat / BUCKET_SIZE);
    const lngBucket = Math.floor(lng / BUCKET_SIZE);

    return `${latBucket}_${lngBucket}`;
}

function calculateRadius(population) {
    if (!population) {
        return 5000;
    }

    if (population >= 10000000) {
        return 50000; // 50 km
    }

    if (population >= 5000000) {
        return 40000;
    }

    if (population >= 1000000) {
        return 25000;
    }

    if (population >= 250000) {
        return 15000;
    }

    if (population >= 50000) {
        return 8000;
    }

    return 5000;
}

function buildReference(inputFilePath, outputFilePath) {
    const locations = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

    const buckets = {};

    let count = 0;

    for (const location of locations) {
        if (location.lat === undefined || location.lng === undefined) {
            continue;
        }

        const record = {
            id: location.id,
            name: location.name,
            city: location.city,
            admin: location.adm,
            country: location.country,
            lat: location.lat,
            lng: location.lng,
            radius: calculateRadius(location.pop),
        };

        const bucket = getBucketKey(location.lat, location.lng);

        if (!buckets[bucket]) {
            buckets[bucket] = [];
        }

        buckets[bucket].push(record);

        count++;
    }

    const output = {
        version: 1,
        bucketSize: BUCKET_SIZE,
        count,
        buckets,
    };

    fs.writeFileSync(outputFilePath, JSON.stringify(output));

    console.log(`Generated ${count} locations`);
    console.log(`Buckets: ${Object.keys(buckets).length}`);
}

buildReference(CITIES_INPUT_FILE, CITIES_OUTPUT_FILE);
buildReference(POI_INPUT_FILE, POI_OUTPUT_FILE);
