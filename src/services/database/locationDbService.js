const { getDb } = require('./database');
const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const mediaTypes = require('../../constants/mediaTypes');

const LOCATION_CLUSTER_CACHE_SIZE = 500;
const MEDIA_LOCATION_CACHE_SIZE = 2000;

const locationClusterCacheByReferenceId = new LRUCache(LOCATION_CLUSTER_CACHE_SIZE);
const imageLocationDetailsCacheByMediaId = new LRUCache(MEDIA_LOCATION_CACHE_SIZE);
const videoLocationDetailsCacheByMediaId = new LRUCache(MEDIA_LOCATION_CACHE_SIZE);
let allLocationClusterNamesCache = null;

let db = null;

const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDb first.');
    }
};

const mapLocationClusterRow = (row) => {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        referenceId: row.reference_id,
        name: row.name,
        alias: row.aliases,
        center_lat: row.center_lat,
        center_lon: row.center_lon,
        radius: row.radius,
    };
};

const getLocationCacheByMediaType = (mediaType) => {
    if (mediaType === mediaTypes.IMAGE) {
        return imageLocationDetailsCacheByMediaId;
    }

    if (mediaType === mediaTypes.VIDEO) {
        return videoLocationDetailsCacheByMediaId;
    }

    throw new Error(`Unsupported mediaType: ${mediaType}`);
};

const getAssociationTableConfig = (mediaType) => {
    if (mediaType === mediaTypes.IMAGE) {
        return {
            tableName: 'image_location_clusters',
            mediaIdColumn: 'image_id',
        };
    }

    if (mediaType === mediaTypes.VIDEO) {
        return {
            tableName: 'video_location_clusters',
            mediaIdColumn: 'video_id',
        };
    }

    throw new Error(`Unsupported mediaType: ${mediaType}`);
};

const clearLocationDbCache = () => {
    locationClusterCacheByReferenceId.clear();
    imageLocationDetailsCacheByMediaId.clear();
    videoLocationDetailsCacheByMediaId.clear();
    allLocationClusterNamesCache = null;
};

const initializeDb = () => {
    db = getDb();

    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        clearLocationDbCache();
    });

    serviceEventBus.subscribe(interServiceEvents.INDEX_DATA_CHANGED, () => {
        clearLocationDbCache();
    });

    clearLocationDbCache();
};

const addLocationToDb = ({ center_lat, center_lon, referenceId, name, alias, radius }) => {
    ensureDbInitialized();

    if (referenceId !== null && typeof referenceId !== 'undefined') {
        const cachedLocationCluster = locationClusterCacheByReferenceId.get(referenceId);
        if (cachedLocationCluster) {
            return cachedLocationCluster;
        }

        const existingLocationCluster = db
            .prepare(
                `
                    SELECT id, reference_id, name, aliases, center_lat, center_lon, radius
                    FROM location_clusters
                    WHERE reference_id = ?
                `,
            )
            .get(referenceId);

        const mappedExistingLocationCluster = mapLocationClusterRow(existingLocationCluster);

        if (mappedExistingLocationCluster) {
            locationClusterCacheByReferenceId.set(referenceId, mappedExistingLocationCluster);
            return mappedExistingLocationCluster;
        }
    }

    const insertLocationClusterStmt = db.prepare(`
        INSERT INTO location_clusters (
            reference_id,
            name,
            aliases,
            center_lat,
            center_lon,
            radius
        ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insertLocationClusterStmt.run(referenceId ?? null, name, alias ?? null, center_lat, center_lon, radius);

    const insertedLocationCluster = {
        id: result.lastInsertRowid,
        referenceId: referenceId ?? null,
        name,
        alias: alias ?? null,
        center_lat,
        center_lon,
        radius,
    };

    if (referenceId !== null && typeof referenceId !== 'undefined') {
        locationClusterCacheByReferenceId.set(referenceId, insertedLocationCluster);
    }

    allLocationClusterNamesCache = null;

    return insertedLocationCluster;
};

const addMediaToLocation = (mediaType, mediaId, locationClusterId) => {
    ensureDbInitialized();

    const normalizedLocationClusterId =
        typeof locationClusterId === 'object' && locationClusterId !== null ? locationClusterId.id : locationClusterId;

    const { tableName, mediaIdColumn } = getAssociationTableConfig(mediaType);
    const locationCacheByMediaId = getLocationCacheByMediaType(mediaType);

    const insertMediaLocationClusterStmt = db.prepare(`
        INSERT OR REPLACE INTO ${tableName} (
            ${mediaIdColumn},
            cluster_id
        ) VALUES (?, ?)
    `);

    insertMediaLocationClusterStmt.run(mediaId, normalizedLocationClusterId);
    locationCacheByMediaId.delete(mediaId);

    return {
        mediaType,
        mediaId,
        locationClusterId: normalizedLocationClusterId,
    };
};

const removeMediaLocation = (mediaType, mediaId) => {
    ensureDbInitialized();

    const { tableName, mediaIdColumn } = getAssociationTableConfig(mediaType);
    const locationCacheByMediaId = getLocationCacheByMediaType(mediaType);

    const deleteMediaLocationStmt = db.prepare(`
        DELETE FROM ${tableName}
        WHERE ${mediaIdColumn} = ?
    `);

    const result = deleteMediaLocationStmt.run(mediaId);
    locationCacheByMediaId.delete(mediaId);

    return result.changes > 0;
};

const getLocationDetailsByMediaId = (mediaType, mediaId, skipCache = false) => {
    ensureDbInitialized();

    const normalizedMediaId = typeof mediaId === 'string' ? mediaId.trim() : mediaId;

    if (!normalizedMediaId) {
        return null;
    }

    const { tableName, mediaIdColumn } = getAssociationTableConfig(mediaType);
    const locationCacheByMediaId = getLocationCacheByMediaType(mediaType);

    const cachedLocationDetails = locationCacheByMediaId.get(normalizedMediaId);
    if (cachedLocationDetails && skipCache === false) {
        return cachedLocationDetails;
    }

    const stmt = db.prepare(`
        SELECT
            lc.id,
            lc.reference_id,
            lc.name,
            lc.aliases,
            lc.center_lat,
            lc.center_lon,
            lc.radius
        FROM ${tableName} mlc
        INNER JOIN location_clusters lc ON lc.id = mlc.cluster_id
        WHERE mlc.${mediaIdColumn} = ?
        LIMIT 1
    `);

    const locationDetails = mapLocationClusterRow(stmt.get(normalizedMediaId));

    if (locationDetails) {
        locationCacheByMediaId.set(normalizedMediaId, locationDetails);
        if (locationDetails.referenceId !== null && typeof locationDetails.referenceId !== 'undefined') {
            locationClusterCacheByReferenceId.set(locationDetails.referenceId, locationDetails);
        }
    }

    return locationDetails;
};

const updateLocationClusterById = (clusterId, clusterDetails = {}) => {
    ensureDbInitialized();

    const { referenceId = null, name, alias = null, center_lat, center_lon, radius } = clusterDetails;

    if (!clusterId || !Number.isInteger(clusterId)) {
        throw new Error('clusterId must be a valid integer');
    }

    if (typeof name !== 'string' || name.trim() === '') {
        throw new Error('name must be a non-empty string');
    }

    if (typeof center_lat !== 'number' || typeof center_lon !== 'number') {
        throw new Error('center_lat and center_lon must be valid numbers');
    }

    if (!Number.isInteger(radius) || radius <= 0) {
        throw new Error('radius must be a positive integer');
    }

    const stmt = db.prepare(`
        UPDATE location_clusters
        SET
            reference_id = ?,
            name = ?,
            aliases = ?,
            center_lat = ?,
            center_lon = ?,
            radius = ?
        WHERE id = ?
    `);

    const result = stmt.run(referenceId, name.trim(), alias, center_lat, center_lon, radius, clusterId);

    if (result.changes === 0) {
        return null;
    }

    clearLocationDbCache();

    return {
        id: clusterId,
        referenceId,
        name: name.trim(),
        alias,
        center_lat,
        center_lon,
        radius,
    };
};

const getLocationClusterDetailsById = (clusterId) => {
    ensureDbInitialized();

    if (!clusterId || !Number.isInteger(clusterId)) {
        throw new Error('clusterId must be a valid integer');
    }

    const stmt = db.prepare(`
        SELECT id, reference_id, name, aliases, center_lat, center_lon, radius
        FROM location_clusters
        WHERE id = ?
        LIMIT 1
    `);

    return mapLocationClusterRow(stmt.get(clusterId));
};

const getCustomLocationClusters = () => {
    ensureDbInitialized();

    const stmt = db.prepare(`
        SELECT id, reference_id, name, aliases, center_lat, center_lon, radius
        FROM location_clusters
        WHERE reference_id IS NULL
    `);

    return stmt.all().map(mapLocationClusterRow);
};

const getAllLocationClusterNames = () => {
    ensureDbInitialized();

    if (Array.isArray(allLocationClusterNamesCache)) {
        return allLocationClusterNamesCache;
    }

    const stmt = db.prepare(
        `
            SELECT id, name, aliases
            FROM location_clusters
        `,
    );

    allLocationClusterNamesCache = stmt.all().flatMap(({ id, name, aliases }) => {
        const locationNames = [];

        if (name) {
            locationNames.push({ id, name });
        }

        if (aliases) {
            locationNames.push({ id, name: aliases });
        }

        return locationNames;
    });

    return Array.isArray(allLocationClusterNamesCache) ? allLocationClusterNamesCache : [];
};

const getMediaIdsByClusterId = (clusterId) => {
    ensureDbInitialized();

    if (!Number.isInteger(clusterId)) {
        throw new Error('LocationDbService: Location cluster id should be a valid integer');
    }

    const imageStmt = db.prepare(`
        SELECT image_id AS mediaId
        FROM image_location_clusters
        WHERE cluster_id = ?
    `);

    const videoStmt = db.prepare(`
        SELECT video_id AS mediaId
        FROM video_location_clusters
        WHERE cluster_id = ?
    `);

    return [
        ...imageStmt.all(clusterId).map(({ mediaId }) => ({ mediaType: mediaTypes.IMAGE, id: mediaId })),
        ...videoStmt.all(clusterId).map(({ mediaId }) => ({ mediaType: mediaTypes.VIDEO, id: mediaId })),
    ];
};

module.exports = {
    initializeDb,

    // read
    getLocationDetailsByMediaId,
    getCustomLocationClusters,
    getLocationClusterDetailsById,
    getAllLocationClusterNames,
    getMediaIdsByClusterId,

    // add
    addLocationToDb,
    addMediaToLocation,

    // update
    updateLocationClusterById,

    // clean
    removeMediaLocation,
    clearLocationDbCache,
};
