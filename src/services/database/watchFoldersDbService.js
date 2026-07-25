const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const LRUCache = require('../service-utils/LRUCache');
const { getDb } = require('./database');

let db = null;

const watchFolderMediaCache = new LRUCache(50);

const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }

    return db;
};

const clearWatchFolderMediaCache = (watchFolderId = null) => {
    if (watchFolderId) {
        watchFolderMediaCache.delete(watchFolderId);
        return;
    }

    watchFolderMediaCache.clear();
};

const initializeDb = () => {
    db = getDb();

    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        clearWatchFolderMediaCache();
    });
};

const getAllWatchFolders = () => {
    ensureDbInitialized();

    return db
        .prepare(
            `
        SELECT id, path, label
        FROM watch_folders
        ORDER BY label ASC
    `,
        )
        .all();
};

const getWatchFolderById = (id) => {
    ensureDbInitialized();

    if (!id) {
        throw new Error('watchFolderId is required');
    }

    return (
        db
            .prepare(
                `
        SELECT id, path, label
        FROM watch_folders
        WHERE id = ?
    `,
            )
            .get(id) || null
    );
};

const addWatchFolder = (id, folderPath, label) => {
    ensureDbInitialized();

    if (!id) {
        throw new Error('watchFolderId is required');
    }

    if (!folderPath) {
        throw new Error('watch folder path is required');
    }

    if (!label) {
        throw new Error('watch folder label is required');
    }

    const stmt = db.prepare(`
        INSERT INTO watch_folders (id, path, label)
        VALUES (?, ?, ?)
    `);

    try {
        stmt.run(id, folderPath, label);
        return { id, path: folderPath, label };
    } catch (error) {
        throw new Error(`Failed to add watch folder: ${error.message}`);
    }
};

const removeWatchFolder = (id) => {
    ensureDbInitialized();

    if (!id) {
        throw new Error('watchFolderId is required');
    }

    const stmt = db.prepare(`
        DELETE FROM watch_folders
        WHERE id = ?
    `);

    try {
        const result = stmt.run(id);

        clearWatchFolderMediaCache(id);
        return result.changes > 0;
    } catch (error) {
        throw new Error(`Failed to remove watch folder: ${error.message}`);
    }
};

const getMediaByWatchFolderId = (watchFolderId) => {
    ensureDbInitialized();

    if (!watchFolderId) {
        throw new Error('watchFolderId is required');
    }

    const cachedMedia = watchFolderMediaCache.get(watchFolderId);
    if (cachedMedia) {
        return cachedMedia;
    }

    const mediaItems = db
        .prepare(
            `
        SELECT
            id,
            watch_folder_id AS watchFolderId,
            path,
            name,
            birthtimeMs,
            year,
            size,
            media_type AS mediaType,
            duration
        FROM watch_folder_media
        WHERE watch_folder_id = ?
        ORDER BY birthtimeMs DESC, name ASC
    `,
        )
        .all(watchFolderId);

    watchFolderMediaCache.set(watchFolderId, mediaItems);

    return mediaItems;
};

const getWatchFolderMediaById = (mediaId) => {
    ensureDbInitialized();

    if (!mediaId) {
        throw new Error('mediaId is required');
    }

    return (
        db
            .prepare(
                `
        SELECT
            id,
            watch_folder_id AS watchFolderId,
            path,
            name,
            birthtimeMs,
            year,
            size,
            media_type AS mediaType,
            duration
        FROM watch_folder_media
        WHERE id = ?
    `,
            )
            .get(mediaId) || null
    );
};

const addWatchFolderMediaItem = (mediaItem) => {
    ensureDbInitialized();

    if (!mediaItem || typeof mediaItem !== 'object') {
        throw new Error('mediaItem is required');
    }

    const { id, watchFolderId, path, name, birthtimeMs, year, size, mediaType, duration } = mediaItem;

    if (!id) {
        throw new Error('mediaItem.id is required');
    }

    if (!watchFolderId) {
        throw new Error('mediaItem.watchFolderId is required');
    }

    if (!path) {
        throw new Error('mediaItem.path is required');
    }

    if (!name) {
        throw new Error('mediaItem.name is required');
    }

    if (birthtimeMs === undefined || birthtimeMs === null) {
        throw new Error('mediaItem.birthtimeMs is required');
    }

    if (year === undefined || year === null) {
        throw new Error('mediaItem.year is required');
    }

    if (size === undefined || size === null) {
        throw new Error('mediaItem.size is required');
    }

    if (!mediaType) {
        throw new Error('mediaItem.mediaType is required');
    }

    const stmt = db.prepare(`
        INSERT INTO watch_folder_media (
            id,
            watch_folder_id,
            path,
            name,
            birthtimeMs,
            year,
            size,
            media_type,
            duration
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
        stmt.run(id, watchFolderId, path, name, birthtimeMs, year, size, mediaType, duration ?? null);

        clearWatchFolderMediaCache(watchFolderId);

        return {
            id,
            watchFolderId,
            path,
            name,
            birthtimeMs,
            year,
            size,
            mediaType,
            duration: duration ?? null,
        };
    } catch (error) {
        throw new Error(`Failed to add watch folder media: ${error.message}`);
    }
};

const addWatchFolderMedia = (mediaItems = []) => {
    ensureDbInitialized();

    if (!Array.isArray(mediaItems)) {
        throw new Error('mediaItems must be an array');
    }

    if (mediaItems.length === 0) {
        return [];
    }

    const affectedWatchFolderIds = new Set();

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO watch_folder_media (
            id,
            watch_folder_id,
            path,
            name,
            birthtimeMs,
            year,
            size,
            media_type,
            duration
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((mediaList) => {
        for (const mediaItem of mediaList) {
            if (!mediaItem || typeof mediaItem !== 'object') {
                throw new Error('each media item must be an object');
            }

            if (!mediaItem.id) {
                throw new Error('mediaItem.id is required');
            }

            if (!mediaItem.watchFolderId) {
                throw new Error('mediaItem.watchFolderId is required');
            }

            if (!mediaItem.path) {
                throw new Error('mediaItem.path is required');
            }

            if (!mediaItem.name) {
                throw new Error('mediaItem.name is required');
            }

            if (mediaItem.birthtimeMs === undefined || mediaItem.birthtimeMs === null) {
                throw new Error('mediaItem.birthtimeMs is required');
            }

            if (mediaItem.year === undefined || mediaItem.year === null) {
                throw new Error('mediaItem.year is required');
            }

            if (mediaItem.size === undefined || mediaItem.size === null) {
                throw new Error('mediaItem.size is required');
            }

            if (!mediaItem.mediaType) {
                throw new Error('mediaItem.mediaType is required');
            }

            insertStmt.run(
                mediaItem.id,
                mediaItem.watchFolderId,
                mediaItem.path,
                mediaItem.name,
                mediaItem.birthtimeMs,
                mediaItem.year,
                mediaItem.size,
                mediaItem.mediaType,
                mediaItem.duration ?? null,
            );

            affectedWatchFolderIds.add(mediaItem.watchFolderId);
        }
    });

    try {
        insertMany(mediaItems);

        for (const watchFolderId of affectedWatchFolderIds) {
            clearWatchFolderMediaCache(watchFolderId);
        }

        return mediaItems;
    } catch (error) {
        throw new Error(`Failed to add watch folder media: ${error.message}`);
    }
};

const removeWatchFolderMedia = (mediaId) => {
    ensureDbInitialized();

    if (!mediaId) {
        throw new Error('mediaId is required');
    }

    const existingMedia = getWatchFolderMediaById(mediaId);

    const stmt = db.prepare(`
        DELETE FROM watch_folder_media
        WHERE id = ?
    `);

    try {
        const result = stmt.run(mediaId);

        if (existingMedia?.watchFolderId) {
            clearWatchFolderMediaCache(existingMedia.watchFolderId);
        }

        return result.changes > 0;
    } catch (error) {
        throw new Error(`Failed to remove watch folder media: ${error.message}`);
    }
};

const removeWatchFolderMediaByWatchFolderId = (watchFolderId) => {
    ensureDbInitialized();

    if (!watchFolderId) {
        throw new Error('watchFolderId is required');
    }

    const stmt = db.prepare(`
        DELETE FROM watch_folder_media
        WHERE watch_folder_id = ?
    `);

    try {
        const result = stmt.run(watchFolderId);

        clearWatchFolderMediaCache(watchFolderId);
        return result.changes;
    } catch (error) {
        throw new Error(`Failed to remove watch folder media: ${error.message}`);
    }
};

module.exports = {
    initializeDb,
    clearWatchFolderMediaCache,
    getAllWatchFolders,
    getWatchFolderById,
    addWatchFolder,
    removeWatchFolder,
    getMediaByWatchFolderId,
    getWatchFolderMediaById,
    addWatchFolderMediaItem,
    addWatchFolderMedia,
    removeWatchFolderMedia,
    removeWatchFolderMediaByWatchFolderId,
};
