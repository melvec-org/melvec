const { getCustomLocationClusters } = require('../database/locationDbService');

const BUCKET_SIZE = 0.25;
const EARTH_RADIUS_METERS = 6371000;

let citiesGeoSpatialReferenceData = null;
let poiGeoSpatialReferenceData = null;

/**
 * Loads the city geo-spatial reference data into memory.
 *
 * The reference data is loaded lazily on the first call to findLocation().
 * Subsequent calls reuse the in-memory reference.
 *
 * @returns {void}
 */
const loadReferenceData = () => {
    if (citiesGeoSpatialReferenceData) return null;
    citiesGeoSpatialReferenceData = require('../../../resources/locations/cities/geoSpatialReference.json');

    if (poiGeoSpatialReferenceData) return null;
    poiGeoSpatialReferenceData = require('../../../resources/locations/poi/geoSpatialReference.json');
};

/**
 * Releases the geo-spatial reference data from memory.
 *
 * This can be called after a media import/batch operation has completed
 * when the reference data is no longer required.
 *
 * @returns {void}
 */
const unloadReferenceData = () => {
    citiesGeoSpatialReferenceData = null;
    poiGeoSpatialReferenceData = null;
};

/**
 * Returns the closest candidate whose radius contains the given coordinate.
 *
 * Each candidate is normalized through the provided accessors so this helper can
 * operate on both custom location clusters and city reference records.
 *
 * @param {number} latitude Latitude to match.
 * @param {number} longitude Longitude to match.
 * @param {Array<Object>} candidates Candidate records to evaluate.
 * @param {(candidate: Object) => number} getLat Returns the candidate latitude.
 * @param {(candidate: Object) => number} getLng Returns the candidate longitude.
 * @param {(candidate: Object) => number} getRadius Returns the candidate radius in meters.
 * @returns {Object|null} The nearest containing candidate, or null if none match.
 */
const findNearestContainingLocation = (latitude, longitude, candidates, getLat, getLng, getRadius) => {
    let bestLocation = null;
    let bestDistance = Number.MAX_VALUE;

    for (const candidate of candidates) {
        const normalizedLocation = {
            lat: getLat(candidate),
            lng: getLng(candidate),
            radius: getRadius(candidate),
        };

        if (!isWithinBoundingBox(latitude, longitude, normalizedLocation)) {
            continue;
        }

        const distance = calculateDistance(latitude, longitude, normalizedLocation.lat, normalizedLocation.lng);

        if (distance <= normalizedLocation.radius && distance < bestDistance) {
            bestDistance = distance;
            bestLocation = candidate;
        }
    }

    return bestLocation;
};

/**
 * Looks up the nearest matching custom location cluster from the database-backed cache.
 *
 * @param {number} latitude Latitude to match.
 * @param {number} longitude Longitude to match.
 * @returns {Object|null} The matching custom cluster record, or null if none contain the coordinate.
 */
const findNearbyCustomLocationCluster = (latitude, longitude) => {
    const customLocationClusters = getCustomLocationClusters();

    return findNearestContainingLocation(
        latitude,
        longitude,
        customLocationClusters,
        (locationCluster) => locationCluster.center_lat,
        (locationCluster) => locationCluster.center_lon,
        (locationCluster) => locationCluster.radius,
    );
};

/**
 * Looks up a nearby point-of-interest cluster.
 *
 *
 * @param {number} latitude Latitude to match.
 * @param {number} longitude Longitude to match.
 * @returns {null} Always null until POI lookup is implemented.
 */
const findNearbyPOILocationCluster = (latitude, longitude) => {
    if (poiGeoSpatialReferenceData === null) loadReferenceData();

    const candidates = findCandidateLocations(latitude, longitude, poiGeoSpatialReferenceData);

    const bestLocation = findNearestContainingLocation(
        latitude,
        longitude,
        candidates,
        (location) => location.lat,
        (location) => location.lng,
        (location) => location.radius,
    );

    if (!bestLocation) {
        return null;
    }

    return {
        referenceId: bestLocation.id,
        name: bestLocation.name || '',
        city: bestLocation.city,
        state: bestLocation.state || '',
        admin: bestLocation.admin,
        country: bestLocation.country,
        centerLat: bestLocation.lat,
        centerLng: bestLocation.lng,
        radius: bestLocation.radius,
    };
};

/**
 * Finds the nearest city reference cluster that contains the coordinate.
 *
 * The geo-spatial reference data is loaded on demand and searched through the
 * bucket index before exact distance checks are performed.
 *
 * @param {number} latitude Latitude to match.
 * @param {number} longitude Longitude to match.
 * @returns {Object|null} Normalized city cluster data, or null if no city contains the coordinate.
 */
const findNearbyCityLocationCluster = (latitude, longitude) => {
    if (citiesGeoSpatialReferenceData === null) loadReferenceData();

    const candidates = findCandidateLocations(latitude, longitude, citiesGeoSpatialReferenceData);

    const bestLocation = findNearestContainingLocation(
        latitude,
        longitude,
        candidates,
        (location) => location.lat,
        (location) => location.lng,
        (location) => location.radius,
    );

    if (!bestLocation) {
        return null;
    }

    return {
        referenceId: bestLocation.id,
        name: bestLocation.name || '',
        city: bestLocation.city,
        state: bestLocation.state || '',
        admin: bestLocation.admin,
        country: bestLocation.country,
        centerLat: bestLocation.lat,
        centerLng: bestLocation.lng,
        radius: bestLocation.radius,
    };
};

/**
 * Resolves a location by preferring named custom clusters, then POI, then city,
 * and finally falling back to an unnamed custom cluster.
 *
 * @param {number} latitude Latitude to match.
 * @param {number} longitude Longitude to match.
 * @returns {Object|null} The best matching location record, or null if nothing matches.
 */
const findLocation = (latitude, longitude) => {
    const customLocation = findNearbyCustomLocationCluster(latitude, longitude);

    if (customLocation?.name) {
        return customLocation;
    }

    return (
        findNearbyPOILocationCluster(latitude, longitude) || findNearbyCityLocationCluster(latitude, longitude) || customLocation || null
    );
};

/**
 * Finds candidate locations using the geo-spatial bucket index.
 *
 * The reference data is divided into fixed geographic buckets.
 * The current bucket and its eight neighboring buckets are searched
 * to account for locations close to bucket boundaries.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {Object} geoSpatialReferenceData Reference dataset whose buckets should be searched.
 *
 * @returns {Array<Object>}
 */
const findCandidateLocations = (latitude, longitude, geoSpatialReferenceData) => {
    const latBucket = Math.floor(latitude / BUCKET_SIZE);
    const lngBucket = Math.floor(longitude / BUCKET_SIZE);

    const candidates = [];

    for (let latOffset = -1; latOffset <= 1; latOffset++) {
        for (let lngOffset = -1; lngOffset <= 1; lngOffset++) {
            const key = `${latBucket + latOffset}_${lngBucket + lngOffset}`;

            const bucket = geoSpatialReferenceData?.buckets?.[key];

            if (bucket) {
                candidates.push(...bucket);
            }
        }
    }

    return candidates;
};

/**
 * Performs a fast bounding-box check around a reference location.
 *
 * This is intentionally an approximation. Its purpose is to avoid
 * expensive trigonometric calculations for candidates that are
 * obviously outside the reference radius.
 *
 * The exact Haversine distance is still calculated after this check.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {Object} location
 *
 * @returns {boolean}
 */
const isWithinBoundingBox = (latitude, longitude, location) => {
    const radius = location.radius;

    const latDelta = radius / 111320;

    const cosLatitude = Math.cos((latitude * Math.PI) / 180);

    // Avoid division by zero near the poles.
    const lngDelta = radius / (111320 * Math.max(Math.abs(cosLatitude), 0.000001));

    return (
        latitude >= location.lat - latDelta &&
        latitude <= location.lat + latDelta &&
        longitude >= location.lng - lngDelta &&
        longitude <= location.lng + lngDelta
    );
};

/**
 * Calculates the great-circle distance between two GPS coordinates
 * using the Haversine formula.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 *
 * @returns {number}
 * Distance in meters.
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const lat1Radians = toRadians(lat1);
    const lat2Radians = toRadians(lat2);

    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1Radians) * Math.cos(lat2Radians) * Math.sin(dLon / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Converts degrees to radians.
 *
 * @param {number} degrees
 *
 * @returns {number}
 */
const toRadians = (degrees) => {
    return (degrees * Math.PI) / 180;
};

module.exports = {
    unloadReferenceData,
    loadReferenceData,
    findNearbyCustomLocationCluster,
    findNearbyPOILocationCluster,
    findNearbyCityLocationCluster,
    findLocation,
};
