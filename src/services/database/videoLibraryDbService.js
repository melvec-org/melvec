const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { getDb } = require('../database/database');
const path = require('path');
const { getRelativeMediaPath } = require('../service-utils/mediaPath');

const CACHE_SIZE = 2000;
const videoCache = new LRUCache(CACHE_SIZE);

let db = null;

// Ensure db is initialized
const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
};

const getAllVideos = () => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT v.id, v.name, v.birthtimeMs, v.collection_id, v.category_id, v.year, v.title, v.size, v.duration, v.source, v.is_nsfw, v.has_preview,
                   c.label AS coll
            FROM videos v
            LEFT JOIN collections c ON v.collection_id = c.id`);

        return stmt.all().map((video) => {
            const relPath = getRelativeMediaPath(video.year, video.coll, video.name, video.id);
            video.path = relPath;
            return video;
        });
    } catch (err) {
        throw new Error(`Error fetching all videos: ${err.message}`);
    }
};

const getVideoDetailsById = (id, skipCache = false) => {
    ensureDbInitialized();

    // Check cache first
    const cached = videoCache.get(id);
    if (cached && skipCache === false) {
        return cached;
    }

    // Query database
    try {
        const stmt = db.prepare(`
            SELECT v.id, v.name, v.birthtimeMs, v.collection_id, v.category_id, v.year, v.title, v.size, v.duration, v.source, v.is_nsfw, v.has_preview,
                   c.label AS coll
            FROM videos v
            LEFT JOIN collections c ON v.collection_id = c.id
            WHERE v.id = ?
        `);

        const video = stmt.get(id);

        if (video) {
            video.path = getRelativeMediaPath(video.year, video.coll, video.name, video.id);
            videoCache.set(id, video);
        }

        return video || null;
    } catch (err) {
        throw new Error(`Error fetching video ${id}: ${err.message}`);
    }
};

const checkForDuplicate = (id) => {
    ensureDbInitialized();
    const cached = videoCache.get(id);
    if (cached) {
        return true;
    }

    try {
        const stmt = db.prepare('SELECT 1 FROM videos WHERE id = ?');
        return !!stmt.get(id);
    } catch (err) {
        throw new Error(`Error checking duplicate for video ${id}: ${err.message}`);
    }
};

/**
 * Adds video to database,
 * Put some validation steps to make sure entries are correct and not leading to null values
 *
 * @param {*} video
 * @returns
 */
const addVideo = (video) => {
    ensureDbInitialized();
    const { id, name, birthtimeMs, collection_id, year, title = '', size, duration = 0, source = 'local' } = video;

    // Validate required fields
    const requiredFields = { id, name, birthtimeMs, collection_id, year, title, size, duration };
    for (const [key, value] of Object.entries(requiredFields)) {
        if (value === null || value === undefined) {
            throw new Error(`Field ${key} cannot be null or undefined`);
        }
    }

    // Validate TEXT fields (non-empty strings)
    // title can be empty while importing, so leaving this here.
    const textFields = { name, collection_id, source };
    for (const [key, value] of Object.entries(textFields)) {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(`Field ${key} must be a non-empty string`);
        }
    }

    // Validate INTEGER fields
    const integerFields = { birthtimeMs, year, size };
    for (const [key, value] of Object.entries(integerFields)) {
        if (!Number.isInteger(value)) {
            throw new Error(`Field ${key} must be an integer`);
        }
    }

    if (year < 0) throw new Error('Year must be non-negative');
    if (size < 0) throw new Error('Size must be non-negative');
    if (duration < 0) throw new Error('Duration must be 0 or positive');
    if (birthtimeMs < 0) throw new Error('birthtimeMs must be non-negative');

    if (checkForDuplicate(id)) {
        throw new Error(`Duplicate ID: ${id} already exists`);
    }
    const stmt = db.prepare(`
    INSERT INTO videos (id, name, birthtimeMs, collection_id, year, title,  size, duration, source,  is_nsfw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    try {
        db.transaction(() => {
            stmt.run(id, name, birthtimeMs, collection_id, year, title, size, duration, source, 0);
        })();
        return id;
    } catch (err) {
        throw new Error(`Failed to add video ${id}: ${err.message}`);
    }
};

const updateVideoDetails = (video) => {
    ensureDbInitialized();
    const { id, name, birthtimeMs, collection_id, year, title, size, duration, source, is_nsfw } = video;

    // Validate required fields
    const requiredFields = { id, name, birthtimeMs, collection_id, year, title, size, duration, source, is_nsfw };
    for (const [key, value] of Object.entries(requiredFields)) {
        if (value === null || value === undefined) {
            throw new Error(`Field ${key} cannot be null or undefined`);
        }
    }

    const textFields = { id, name, collection_id, source };
    for (const [key, value] of Object.entries(textFields)) {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(`Field ${key} must be a non-empty string`);
        }
    }

    const integerFields = { birthtimeMs, year, size };
    for (const [key, value] of Object.entries(integerFields)) {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`Field ${key} must be a non-negative integer`);
        }
    }

    const stmt = db.prepare(`
        UPDATE videos
        SET 
            name = ?, 
            birthtimeMs = ?, 
            collection_id=?, 
            year = ?, 
            title = ?, 
            size = ?, 
            duration = ?,
            source =?,
            is_nsfw = ?
        WHERE 
            id = ?
      `);

    try {
        const info = db.transaction(() => {
            const result = stmt.run(name, birthtimeMs, collection_id, year, title, size, duration, source, is_nsfw, path, id);
            return result;
        })();

        if (info.changes > 0) {
            const video = getVideoDetailsById(id, true);

            videoCache.set(id, video);
            return video;
        }
    } catch (err) {
        throw new Error(`Failed to update video ${id}: ${err.message}`);
    }
};

const getAllVideoIds = () => {
    ensureDbInitialized();
    try {
        const stmt = db.prepare('SELECT id FROM videos');
        return stmt.all().map((row) => row.id);
    } catch (err) {
        throw new Error(`Error fetching video IDs: ${err.message}`);
    }
};

const deleteVideo = (id) => {
    ensureDbInitialized();
    const stmt = db.prepare('DELETE FROM videos WHERE id = ?');

    try {
        const info = db.transaction(() => {
            const result = stmt.run(id);
            if (result.changes > 0) {
                videoCache.delete(id);
            }
            return result;
        })();
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to delete video ${id}: ${err.message}`);
    }
};

const checkVideoExists = (video_id) => {
    const stmt = db.prepare('SELECT id FROM videos WHERE id = ?');
    return !!stmt.get(video_id);
};

/**
 * this function should search videos by title.this is partial matching and case insensitive
 * @param {} keyword
 * @returns
 */
const getVideoByTitleSearch = (keyword) => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT id, title
            FROM videos
            WHERE title IS NOT NULL AND LOWER(title) LIKE ?
        `);

        const videos = stmt.all(`%${keyword.toLowerCase()}%`);

        return videos.map((video) => ({
            id: video.id,
            title: video.title,
        }));
    } catch (err) {
        throw new Error(`Error searching videos by title: ${err.message}`);
    }
};

const updateSource = (video_id, source) => {
    ensureDbInitialized();

    if (video_id === null || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }
    if (!source || typeof source !== 'string' || source.trim() === '') {
        throw new Error('Field source must be a non-empty string');
    }

    const existing = getVideoDetailsById(video_id, true);
    if (!existing) {
        throw new Error(`Video not found: ${video_id}`);
    }

    const updated = updateVideoDetails({ ...existing, source });
    return !!updated;
};

const getVideosByFileNameSearch = (keyword) => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT id, name
            FROM videos
            WHERE name IS NOT NULL AND LOWER(name) LIKE ?
        `);

        const videos = stmt.all(`%${keyword.toLowerCase()}%`);

        return videos.map((video) => ({
            id: video.id,
            name: video.name,
        }));
    } catch (err) {
        throw new Error(`Error searching videos by file name: ${err.message}`);
    }
};

const updateCategory = (video_id, category_id) => {
    ensureDbInitialized();

    if (video_id === null || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }

    if (category_id !== null && typeof category_id === 'string') {
        category_id = category_id.trim();
    }

    if (category_id !== null && (typeof category_id !== 'string' || category_id.trim() === '')) {
        throw new Error('Field category_id must be null or a non-empty string');
    }

    const existing = getVideoDetailsById(video_id, true);
    if (!existing) {
        throw new Error(`Video not found: ${video_id}`);
    }

    if (category_id !== null) {
        const categoryStmt = db.prepare(`
            SELECT id
            FROM video_categories
            WHERE id = ?
        `);
        const category = categoryStmt.get(category_id);

        if (!category) {
            throw new Error(`Invalid category_id: ${category_id}`);
        }
    }

    const stmt = db.prepare(`
        UPDATE videos
        SET category_id = ?
        WHERE id = ?
    `);

    try {
        const info = db.transaction(() => {
            const result = stmt.run(category_id, video_id);
            return result;
        })();

        if (info.changes > 0) {
            const video = getVideoDetailsById(video_id, true);

            videoCache.set(video_id, video);
            return true;
        }

        return false;
    } catch (err) {
        throw new Error(`Failed to update category for video ${video_id}: ${err.message}`);
    }
};

const getVideosByCategoryId = (categoryId) => {
    if (categoryId === '' || !categoryId) return [];
    ensureDbInitialized();

    const stmt = db.prepare(`
            SELECT id
            FROM videos
            WHERE category_id = ?
        `);
    try {
        const videoIds = stmt.all(categoryId);

        return videoIds.map((item) => item.id);
    } catch (err) {
        throw new Error(`Error fetching videos by cagtegory id ${categoryId}`);
    }
};

const getVideoIdsWithoutPreview = () => {
    ensureDbInitialized();
    try {
        const stmt = db.prepare(`SELECT * FROM videos WHERE has_preview = 0`);

        return stmt.all().map((row) => row.id);
    } catch (err) {
        throw new Error(`Error fetching video IDs without preview: ${err.message}`);
    }
};

const clearAllPreviewStatuses = () => {
    ensureDbInitialized();
    try {
        db.prepare(`UPDATE videos SET has_preview = 0`).run();
        videoCache.clear();
    } catch (err) {
        throw new Error(`Failed to reset has_preview flags: ${err.message}`);
    }
};

const updateHasPreviewStatus = (videoId, hasPreview) => {
    ensureDbInitialized();

    if (!videoId || typeof videoId !== 'string' || videoId.trim() === '') {
        throw new Error('Field videoId must be a non-empty string');
    }

    const stmt = db.prepare(`UPDATE videos SET has_preview = ? WHERE id = ?`);

    try {
        const info = db.transaction(() => stmt.run(hasPreview ? 1 : 0, videoId))();
        if (info.changes > 0) {
            videoCache.delete(videoId);
        }
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to update has_preview for video ${videoId}: ${err.message}`);
    }
};

/**
 * Returns titles and metadata descriptions for a batch of video IDs.
 * Fetches both fields in one query to avoid 2 DB calls per video.
 * Callers should pass small batches (100-200 IDs) to keep memory low.
 *
 * This is useful for any batch calls like in vocabular buiding and search
 *
 * @param {string[]} ids - Array of video IDs to fetch.
 * @returns {Array<{id: string, title: string|null, description: string|null}>}
 */
const getVideoTitlesAndDescriptionsByIds = (ids = []) => {
    ensureDbInitialized();

    if (!ids.length) return [];

    try {
        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT v.id, v.title, m.description
            FROM videos v
            LEFT JOIN video_metadata m ON m.video_id = v.id
            WHERE v.id IN (${placeholders})
        `);

        return stmt.all(...ids);
    } catch (err) {
        throw new Error(`Failed to fetch video titles and descriptions: ${err.message}`);
    }
};

const resetVideosTitleAndCategory = (ids) => {
    ensureDbInitialized();

    if (!Array.isArray(ids) || !ids.length) {
        throw new Error('Invalid arguments');
    }

    const stmt = db.prepare(`
        UPDATE videos
        SET title = '', category_id = NULL
        WHERE id IN (${ids.map(() => '?').join(',')})
    `);

    // remove cache for these specific videos
    try {
        stmt.run(...ids);
        ids.forEach((id) => videoCache.delete(id));
        return true;
    } catch (err) {
        throw new Error(`Failed to reset videos title and category: ${err.message}`);
    }
};

const clearVideosDbCache = () => videoCache.clear();

const initializeDb = () => {
    // in case of re-initialization of the video library
    db = getDb();
    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        videoCache.clear();
    });
    serviceEventBus.subscribe(interServiceEvents.INDEX_DATA_CHANGED, () => {
        videoCache.clear();
    });
    videoCache.clear();
};

module.exports = {
    // get operations
    getAllVideoIds,
    getAllVideos,
    getVideoDetailsById,
    getVideoByTitleSearch,
    getVideosByFileNameSearch,
    getVideosByCategoryId,
    getVideoIdsWithoutPreview,
    getVideoTitlesAndDescriptionsByIds,

    // set operations
    addVideo,
    deleteVideo,
    updateSource,
    updateCategory,
    updateVideoDetails,
    resetVideosTitleAndCategory,
    updateHasPreviewStatus,

    // other oeperations
    checkVideoExists,
    checkForDuplicate,
    clearVideosDbCache,
    clearAllPreviewStatuses,

    initializeDb,
};
