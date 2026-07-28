const LRUCache = require('../service-utils/LRUCache');
const { getDb } = require('./database');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const systemConfig = require('../../configs/systemConfig');
const mediaTypes = require('../../constants/mediaTypes');

const CACHE_SIZE = 1000;
const CACHE_ALL_NAMES_KEY = '__all_names__';
const collectionsCache = new LRUCache(CACHE_SIZE);
let db = null;

const initializeDb = () => {
    collectionsCache.clear();
    db = getDb();
    if (getCollectionDetailsById(systemConfig.DEFAULT_COLLECTION_ID) === null) {
        createDefaultCollection();
    }

    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        collectionsCache.clear();
        db = newDb;
        if (getCollectionDetailsById(systemConfig.DEFAULT_COLLECTION_ID) === null) {
            createDefaultCollection();
        }
    });
};

const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
};

// Validate collection data
const validateCollection = (id, label, year, isHidden) => {
    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }
    if (!label || typeof label !== 'string' || label.trim() === '') {
        throw new Error('Field label must be a non-empty string');
    }
    if (typeof year !== 'number' || isNaN(year)) {
        throw new Error('Field year must be a number');
    }
    if (typeof isHidden !== 'boolean') {
        throw new Error('Field isHidden must be a boolean');
    }
};

/**
 * default collection serves the reserved collection name and it should keep all files that does not have any parent collection
 */
const createDefaultCollection = () => {
    ensureDbInitialized();
    const defaultId = systemConfig.DEFAULT_COLLECTION_ID;
    const defaultLabel = systemConfig.DEFAULT_COLLECTION_NAME;
    const defaultYear = systemConfig.DEFAULT_COLLECTION_YEAR;

    try {
        addCollection(defaultId, defaultLabel, defaultYear);
    } catch (err) {
        console.error(`Failed to create default collection: ${err.message}`);
        throw err;
    }
};

// Add or update a collection
const addCollection = (id, label, year, isHidden = false) => {
    ensureDbInitialized();
    validateCollection(id, label, year, isHidden);

    const normalizedLabel = label.trim();
    const normalizedIsHidden = isHidden ? true : false;

    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO collections 
                (id, label, year, isHidden) 
            VALUES 
                (?, ?, ?, ?)
        `);

        const result = db.transaction(() => {
            const info = stmt.run(id, normalizedLabel, year, normalizedIsHidden ? 1 : 0);

            if (info.changes > 0) {
                // Force fresh reload of collection + videoIds on next access
                clearCollectionCache(id);
            }

            return info;
        })();

        return result.changes > 0;
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed: collections.year, collections.label')) {
            throw new Error(`Collection "${normalizedLabel}" (${normalizedYear}) already exists`);
        }

        throw new Error(`Failed to add/update collection ${id}: ${err.message}`);
    }
};

const getCollectionByYearAndLabel = (year, label) => {
    ensureDbInitialized();

    // Validate both year and label
    if (isNaN(parseInt(year, 10))) {
        throw new Error('Year must be a valid number');
    }
    if (!label || typeof label !== 'string' || label.trim() === '') {
        throw new Error('Label must be a non-empty string');
    }

    try {
        const stmt = db.prepare('SELECT * FROM collections WHERE year = ? AND label = ?');
        const result = stmt.get(year, label);

        return result || null;
    } catch (err) {
        throw new Error(`Error fetching collection ${year} ${label}: ${err.message}`);
    }
};

// Get a collection by id
const getCollectionDetailsById = (id) => {
    ensureDbInitialized();

    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }

    // 1. Check cache first (this is the fast path)
    const cached = collectionsCache.get(id);
    if (cached?.mediaItems && cached?.videoIds && cached?.imageIds) {
        return cached;
    }

    try {
        // 2. Fetch collection metadata
        const collStmt = db.prepare(`
            SELECT 
                id, label, year, isHidden
            FROM collections 
            WHERE id = ? 
            LIMIT 1
        `);
        const collection = collStmt.get(id);

        if (!collection) {
            return null;
        }

        if (typeof collection.isHidden === 'number') {
            collection.isHidden = !!collection.isHidden;
        }
        // 3. Fetch video IDs in this collection (fast indexed query)
        const videoRows = db
            .prepare(
                `
            SELECT id, birthtimeMs
            FROM videos
            WHERE collection_id = ?
        `,
            )
            .all(id);

        const imageRows = db
            .prepare(
                `
            SELECT id, birthtimeMs
            FROM images
            WHERE collection_id = ?
        `,
            )
            .all(id);

        const audioRows = db
            .prepare(
                `SELECT id, birthtimeMs
            FROM audios
            WHERE collection_id = ?`,
            )
            .all(id);

        const videoIds = videoRows.map((row) => row.id);
        const imageIds = imageRows.map((row) => row.id);
        const audioIds = audioRows.map((row) => row.id);

        const mediaItems = [
            ...videoRows.map((row) => ({ id: row.id, mediaType: mediaTypes.VIDEO, birthtimeMs: row.birthtimeMs })),
            ...imageRows.map((row) => ({ id: row.id, mediaType: mediaTypes.IMAGE, birthtimeMs: row.birthtimeMs })),
            ...audioRows.map((row) => ({ id: row.id, mediaType: mediaTypes.AUDIO, birthtimeMs: row.birthtimeMs })),
        ]
            .sort((a, b) => (b.birthtimeMs || 0) - (a.birthtimeMs || 0))
            .map((row) => ({
                id: row.id,
                mediaType: row.mediaType,
            }));

        const richCollection = {
            ...collection,
            mediaItems,
            mediaCount: mediaItems.length,
            videoCount: videoIds.length,
            imageCount: imageIds.length,
            audioCount: audioIds.length,
        };

        // 5. Cache it
        collectionsCache.set(id, richCollection);

        return richCollection;
    } catch (err) {
        throw new Error(`Failed to get collection ${id}: ${err.message}`);
    }
};

// Delete a collection
const deleteCollection = (id) => {
    ensureDbInitialized();
    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }

    try {
        const result = db.transaction(() => {
            // 1. Check if collection exists
            const collStmt = db.prepare('SELECT id, label, year FROM collections WHERE id = ?');
            const collection = collStmt.get(id);

            if (!collection) {
                return { changes: 0 };
            }

            // 2. Check if collection has any videos (critical safety check)
            const videoCountStmt = db.prepare(`
                SELECT COUNT(*) as count 
                FROM videos 
                WHERE collection_id = ?
            `);
            const { count } = videoCountStmt.get(id);

            if (count > 0) {
                throw new Error(
                    `Cannot delete collection "${collection.label}" (${collection.year}) ` +
                        `because it contains ${count} video(s). ` +
                        `Move or delete the videos first.`,
                );
            }

            // Proceed with deletion
            // 3. Safe to delete — no videos reference this collection
            const deleteStmt = db.prepare('DELETE FROM collections WHERE id = ?');
            const deleteResult = deleteStmt.run(id);

            if (deleteResult.changes > 0) {
                // Clear cache
                collectionsCache.delete(id);
                collectionsCache.delete(CACHE_ALL_NAMES_KEY);
            }

            return deleteResult;
        })();

        return result.changes > 0;
    } catch (err) {
        throw new Error(`Failed to delete collection ${id}: ${err.message}`);
    }
};

/**
 * @param {id} id
 * @param {*} newLabel
 * @returns updated collection
 */
const renameCollectionLabel = (id, newLabel) => {
    ensureDbInitialized();
    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }
    if (!newLabel || typeof newLabel !== 'string' || newLabel.trim() === '') {
        throw new Error('Field newLabel must be a non-empty string');
    }

    try {
        const results = db.transaction(() => {
            // Check existence + fetch current data in one query
            const stmtCheck = db.prepare(`
                SELECT label, year, isHidden 
                FROM collections 
                WHERE id = ? 
                LIMIT 1
            `);
            const collection = stmtCheck.get(id);

            if (!collection) {
                return { changes: 0 };
            }

            // do the renaming
            const stmtUpdate = db.prepare(`
                UPDATE collections 
                SET label = ? 
                WHERE id = ?
            `);
            const updateInfo = stmtUpdate.run(newLabel.trim(), id);

            if (updateInfo.changes === 0) {
                return { changes: 0 };
            }

            // reset cache
            collectionsCache.set(id);
            collectionsCache.delete(CACHE_ALL_NAMES_KEY);

            const updatedCollection = getCollectionDetailsById(id);

            return updatedCollection;
        })();

        return results && results.changes > 0;
    } catch (err) {
        throw new Error(`Failed to rename collection ${id}: ${err.message}`);
    }
};

const getAllCollectionNames = () => {
    ensureDbInitialized();

    const cached = collectionsCache.get(CACHE_ALL_NAMES_KEY);
    if (cached) {
        return cached;
    }

    try {
        const stmt = db.prepare('SELECT id, label, year, isHidden FROM collections');
        const results = stmt.all();

        // reverse results to get most recent first and default collection becomes the last item
        const collectionNames = results.map((row) => ({ id: row.id, label: row.label, year: row.year, isHidden: row.isHidden })).reverse();
        collectionsCache.set(CACHE_ALL_NAMES_KEY, collectionNames);

        return collectionNames;
    } catch (err) {
        throw new Error(`Error fetching collection names: ${err.message}`);
    }
};

const hideCollection = (collectionId) => {
    ensureDbInitialized();
    if (!collectionId || typeof collectionId !== 'string' || collectionId.trim() === '') {
        throw new Error('Field collectionId must be a non-empty string');
    }
    try {
        const stmt = db.prepare(`UPDATE collections SET isHidden = TRUE WHERE id = ?`);
        const result = stmt.run(collectionId);
        clearCollectionCache();
        return result.changes > 0;
    } catch (err) {
        throw new Error(`Failed to hide collection ${collectionId}: ${err.message}`);
    }
};

const unhideCollection = (collectionId) => {
    ensureDbInitialized();
    if (!collectionId || typeof collectionId !== 'string' || collectionId.trim() === '') {
        throw new Error('Field collectionId must be a non-empty string');
    }
    try {
        const stmt = db.prepare(`UPDATE collections SET isHidden = FALSE WHERE id = ?`);
        const result = stmt.run(collectionId);
        clearCollectionCache();
        return result.changes > 0;
    } catch (err) {
        throw new Error(`Failed to show collection ${collectionId}: ${err.message}`);
    }
};

const clearCollectionCache = (collectionId) => {
    collectionsCache.delete(collectionId);
    collectionsCache.delete(CACHE_ALL_NAMES_KEY);
};

const doesCollectionExists = (collectionId) => {
    ensureDbInitialized();
    if (!collectionId || typeof collectionId !== 'string' || collectionId.trim() === '') {
        throw new Error('Field collectionId must be a non-empty string');
    }
    const stmt = db.prepare('SELECT id FROM collections WHERE id =?');
    const result = stmt.get(collectionId);
    return result !== undefined;
};

module.exports = {
    initializeDb,
    addCollection,
    getCollectionDetailsById,

    deleteCollection,
    renameCollectionLabel,
    getAllCollectionNames,
    hideCollection,
    unhideCollection,
    doesCollectionExists,
    getCollectionByYearAndLabel,
    clearCollectionCache,
};
