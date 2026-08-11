const fs = require('fs');
const path = require('path');

const CITIES_INPUT_FILE = path.join(__dirname, './cities/cities.normalized.json');
const CITIES_OUTPUT_FILE = path.join(__dirname, './poi/geoSpatialReference.json');

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

function buildReference() {
    const cities = JSON.parse(fs.readFileSync(CITIES_INPUT_FILE, 'utf8'));

    const buckets = {};

    let count = 0;

    for (const city of cities) {
        if (city.lat === undefined || city.lng === undefined) {
            continue;
        }

        const record = {
            id: city.id,
            city: city.city,
            admin: city.adm,
            country: city.cty,
            lat: city.lat,
            lng: city.lng,
            sr: calculateRadius(city.pop),
        };

        const bucket = getBucketKey(city.lat, city.lng);

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

    fs.writeFileSync(CITIES_OUTPUT_FILE, JSON.stringify(output));

    console.log(`Generated ${count} locations`);
    console.log(`Buckets: ${Object.keys(buckets).length}`);
}

buildReference();
