const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { getDb } = require('./database');
const { checkVideoExists } = require('./videoLibraryDbService');
const { checkImageExists } = require('./imageLibraryDbService');
const { checkAudioExists } = require('./audioLibraryDbService');

const CACHE_SIZE = 1000;

// tags cache will contain tag references for videos. All videos by tag will be extracted by direct query
const tagsCache = new LRUCache(CACHE_SIZE);
const CACHE_TAG_LABELS_KEY = '__cache_tag_labels__';
let db = null;

/**
 * Initializes the tags database service and binds it to the active database instance.
 * Also clears the in-memory cache and refreshes the db reference whenever the
 * database-initialized inter-service event is emitted.
 *
 * @returns {void}
 */
const initializeDb = () => {
    db = getDb();
    tagsCache.clear();

    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        tagsCache.clear();
    });
};

/**
 * Ensures the database instance has been initialized before any operation runs.
 *
 * @throws {Error} When the database has not been initialized.
 * @returns {void}
 */
const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
};

/**
 * Validates a tag label.
 *
 * @param {string} name - Tag label to validate.
 * @throws {Error} When the label is empty or not a string.
 * @returns {void}
 */
const validateTagName = (name) => {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new Error('Field name must be a non-empty string');
    }
};
/**
 * Validates a generic string identifier.
 *
 * @param {string} id - Identifier value.
 * @param {string} fieldName - Field name used in the error message.
 * @throws {Error} When the id is empty or not a string.
 * @returns {void}
 */
const validateId = (id, fieldName) => {
    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error(`Field ${fieldName} must be a non-empty string`);
    }
};

/**
 * Checks whether a tag exists.
 *
 * @param {string} tagId - Tag id.
 * @returns {boolean} True when the tag exists.
 */
const checkTagExists = (tagId) => {
    ensureDbInitialized();
    if (tagsCache.get(tagId)) return true;

    const stmt = db.prepare('SELECT id FROM tags WHERE id = ?');
    return !!stmt.get(tagId);
};

/**
 * Checks whether a tag label already exists.
 *
 * @param {string} label - Tag label.
 * @returns {boolean} True when a tag with the label exists.
 */
const checkTagLabelExists = (label) => {
    ensureDbInitialized();

    const stmt = db.prepare('SELECT id FROM tags WHERE label =?');
    return !!stmt.get(label);
};

/**
 * Creates a new tag.
 *
 * @param {string} id - Tag id.
 * @param {string} label - Tag label.
 * @throws {Error} When validation fails, the label already exists, or insertion fails.
 * @returns {{id: string, label: string, created_at: number}} The created tag.
 */
const addTag = (id, label) => {
    ensureDbInitialized();
    validateTagName(label);
    validateId(id, 'tagId');
    if (checkTagLabelExists(label)) {
        throw new Error(`Tag with label ${label} already exists`);
    }
    const tagId = id;
    const createdAt = Date.now();

    const stmt = db.prepare(`
         INSERT INTO tags (id, label, created_at)
         VALUES (?, ?, ?)
     `);

    try {
        const info = db.transaction(() => {
            const result = stmt.run(tagId, label, createdAt);

            if (result.changes > 0) {
                tagsCache.delete(CACHE_TAG_LABELS_KEY);
            }
            return result;
        })();

        return { id: tagId, label, created_at: createdAt };
    } catch (err) {
        throw new Error(`Failed to add tag ${label}: ${err.message}`);
    }
};

/**
 * Removes a tag by id.
 *
 * @param {string} tagId - Tag id.
 * @throws {Error} When validation fails or deletion fails.
 * @returns {boolean} True when a tag row was removed.
 */
const removeTagById = (tagId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');

    try {
        const info = db.transaction(() => {
            const stmt = db.prepare('DELETE FROM tags WHERE id = ?');
            const info = stmt.run(tagId);

            if (info.changes > 0) {
                tagsCache.clear();
            }
            return info;
        })();
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to remove tag ${tagId}: ${err.message}`);
    }
};

/**
 * Renames an existing tag.
 *
 * @param {string} tagId - Tag id.
 * @param {string} newLabel - New tag label.
 * @throws {Error} When validation fails or update fails.
 * @returns {boolean} True when the tag was updated.
 */
const renameTagById = (tagId, newLabel) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');
    validateTagName(newLabel);

    try {
        const info = db.transaction(() => {
            const stmt = db.prepare('UPDATE tags SET label =? WHERE id =?');
            const info = stmt.run(newLabel, tagId);

            if (info.changes > 0) {
                tagsCache.delete(CACHE_TAG_LABELS_KEY);
            }
            return info;
        })();
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to rename tag ${tagId} to ${newLabel}: ${err.message}`);
    }
};

/**
 * Returns video ids associated with a tag.
 *
 * @param {string} tagId - Tag id.
 * @throws {Error} When the tag does not exist or the query fails.
 * @returns {string[]} Ordered list of video ids for the tag.
 */
const getVideoIdsByTag = (tagId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');

    try {
        if (!checkTagExists(tagId)) {
            throw new Error(`Tag ${tagId} does not exist`);
        }

        const stmt = db.prepare(`
                SELECT video_id FROM tags_videos
                WHERE tag_id =?
                ORDER BY added_at ASC
            `);
        videoIds = stmt.all(tagId).map((row) => row.video_id);

        return videoIds;
    } catch (err) {
        throw new Error(`Failed to fetch video IDs for tag ${tagId}: ${err.message}`);
    }
};

const getImageIdsByTag = (tagId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');

    try {
        if (!checkTagExists(tagId)) {
            throw new Error(`Tag ${tagId} does not exist`);
        }

        const stmt = db.prepare(`
                SELECT image_id FROM tags_images
                WHERE tag_id =?
                ORDER BY added_at ASC
            `);
        const imageIds = stmt.all(tagId).map((row) => row.image_id);

        return imageIds;
    } catch (err) {
        throw new Error(`Failed to fetch image IDs for tag ${tagId}: ${err.message}`);
    }
};

/**
 * Returns ordered video records associated with a tag.
 *
 * @param {string} tagId - Tag id.
 * @throws {Error} When the tag does not exist or the query fails.
 * @returns {Array<{id: string, name: string, birthtimeMs: number, collection_id: string|null, coll: string|null, year: number|null, title: string|null, path: string, size: number, duration: number|null}>}
 * Ordered list of video summaries for the tag.
 */
const getVideosByTag = (tagId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');

    try {
        if (!checkTagExists(tagId)) {
            throw new Error(`Tag ${tagId} does not exist`);
        }

        const stmt1 = db.prepare(`
                SELECT video_id FROM tags_videos
                WHERE tag_id =?
                ORDER BY added_at ASC
            `);
        let videoIds = stmt1.all(tagId).map((row) => row.video_id);

        if (videoIds.length === 0) {
            return [];
        }

        const placeholders = videoIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT v.id, v.name, v.birthtimeMs, v.collection_id, v.year, v.title, v.path, v.size, v.duration,
                   c.label AS coll
            FROM videos v
            LEFT JOIN collections c ON v.collection_id = c.id
            WHERE v.id IN (${placeholders})
        `);
        const videos = stmt.all(...videoIds);
        const videoMap = new Map(videos.map((v) => [v.id, v]));
        const orderedVideos = videoIds
            .map((id) => videoMap.get(id))
            .filter((v) => v)
            .map((video) => ({
                id: video.id,
                name: video.name,
                birthtimeMs: video.birthtimeMs,
                collection_id: video.collection_id,
                coll: video.coll || null,
                year: video.year,
                title: video.title,
                path: video.path,
                size: video.size,
                duration: video.duration,
            }));

        return orderedVideos;
    } catch (err) {
        throw new Error(`Failed to fetch videos for tag ${tagId}: ${err.message}`);
    }
};

/**
 * Associates a video with a tag.
 *
 * @param {string} tagId - Tag id.
 * @param {string} videoId - Video id.
 * @throws {Error} When validation fails, the tag/video does not exist, or insertion fails.
 * @returns {boolean} True when a new mapping was inserted.
 */
const addVideoToTag = (tagId, videoId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');
    validateId(videoId, 'videoId');

    try {
        const info = db.transaction(() => {
            if (!checkTagExists(tagId)) {
                throw new Error(`Tag ${tagId} does not exist`);
            }
            if (!checkVideoExists(videoId)) {
                throw new Error(`Video ${videoId} does not exist`);
            }

            const existsStmt = db.prepare(`
                SELECT 1 FROM tags_videos WHERE tag_id =? AND video_id =?
            `);
            if (existsStmt.get(tagId, videoId)) {
                return;
            }

            const stmt = db.prepare(`
                INSERT INTO tags_videos (tag_id, video_id, added_at)
                VALUES (?,?,?)
            `);
            const result = stmt.run(tagId, videoId, Date.now());

            if (result.changes > 0) {
                const tagIds = tagsCache.get(videoId) || [];

                tagIds.push(getTagById(tagId));
                tagsCache.set(videoId, tagIds);
            }
            return result;
        })();
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to add video to tag ${tagId}: ${err.message}`);
    }
};

/**
 * Associates an image with a tag.
 *
 * @param {string} tagId - Tag id.
 * @param {string} imageId - Image id.
 * @throws {Error} When validation fails, the tag/image does not exist, or insertion fails.
 * @returns {boolean} True when a new mapping was inserted.
 */
const addImageToTag = (tagId, imageId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');
    validateId(imageId, 'imageId');

    try {
        const info = db.transaction(() => {
            if (!checkTagExists(tagId)) {
                throw new Error(`Tag ${tagId} does not exist`);
            }
            if (!checkImageExists(imageId)) {
                throw new Error(`Image ${imageId} does not exist`);
            }

            const existsStmt = db.prepare(`
                SELECT 1 FROM tags_images WHERE tag_id =? AND image_id =?
            `);
            if (existsStmt.get(tagId, imageId)) {
                return { changes: 0 };
            }

            const stmt = db.prepare(`
                INSERT INTO tags_images (tag_id, image_id, added_at)
                VALUES (?,?,?)
            `);
            const result = stmt.run(tagId, imageId, Date.now());

            if (result.changes > 0) {
                const tagIds = tagsCache.get(imageId) || [];
                tagIds.push(getTagById(tagId));
                tagsCache.set(imageId, tagIds);
            }

            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to add image to tag ${tagId}: ${err.message}`);
    }
};

/**
 * Removes a video-to-tag association.
 *
 * @param {string} tagId - Tag id.
 * @param {string} videoId - Video id.
 * @throws {Error} When validation fails, the tag/video does not exist, or deletion fails.
 * @returns {boolean} True when a mapping was removed.
 */
const removeVideoFromTag = (tagId, videoId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');
    validateId(videoId, 'videoId');

    try {
        const info = db.transaction(() => {
            if (!checkTagExists(tagId)) {
                throw new Error(`Tag ${tagId} does not exist`);
            }
            if (!checkVideoExists(videoId)) {
                throw new Error(`Video ${videoId} does not exist`);
            }

            const existsStmt = db.prepare(`
                SELECT 1 FROM tags_videos WHERE tag_id =? AND video_id =?
            `);
            if (!existsStmt.get(tagId, videoId)) {
                return;
            }

            const stmt = db.prepare('DELETE FROM tags_videos WHERE tag_id = ? AND video_id =?');
            const result = stmt.run(tagId, videoId);
            if (result.changes > 0) {
                tagsCache.delete(videoId);
            }
            return result;
        })();
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to remove video from tag ${tagId}: ${err.message}`);
    }
};

/**
 * Removes an image-to-tag association.
 *
 * @param {string} tagId - Tag id.
 * @param {string} imageId - Image id.
 * @throws {Error} When validation fails, the tag/image does not exist, or deletion fails.
 * @returns {boolean} True when a mapping was removed.
 */
const removeImageFromTag = (tagId, imageId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');
    validateId(imageId, 'imageId');

    try {
        const info = db.transaction(() => {
            if (!checkTagExists(tagId)) {
                throw new Error(`Tag ${tagId} does not exist`);
            }
            if (!checkImageExists(imageId)) {
                throw new Error(`Image ${imageId} does not exist`);
            }

            const existsStmt = db.prepare(`
                SELECT 1 FROM tags_images WHERE tag_id =? AND image_id =?
            `);
            if (!existsStmt.get(tagId, imageId)) {
                return { changes: 0 };
            }

            const stmt = db.prepare('DELETE FROM tags_images WHERE tag_id = ? AND image_id =?');
            const result = stmt.run(tagId, imageId);

            if (result.changes > 0) {
                tagsCache.delete(imageId);
            }

            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to remove image from tag ${tagId}: ${err.message}`);
    }
};

/**
 * Returns every tag-to-video mapping row for debugging purposes.
 *
 * @returns {Array<{tagId: string, label: string, createdAt: number, videoId: string|null}>}
 * Flat list of tag/video mapping rows.
 */
const getAllTagVideoMaps = () => {
    ensureDbInitialized();
    const stmt = db.prepare(`
        SELECT t.id, t.label, t.created_at, tv.video_id
        FROM tags t
        LEFT JOIN tags_videos tv ON t.id = tv.tag_id
        ORDER BY t.label ASC
    `);
    const allTagVideoMaps = stmt.all();
    return allTagVideoMaps.map((tagVideoMap) => ({
        tagId: tagVideoMap.id,
        label: tagVideoMap.label,
        createdAt: tagVideoMap.created_at,
        videoId: tagVideoMap.video_id,
    }));
};

/**
 * Returns tags associated with a video.
 *
 * @param {string} videoId - Video id.
 * @throws {Error} When the video does not exist or the query fails.
 * @returns {Array<{id: string, label: string}>} Tags attached to the video.
 */
const getTagsByVideoId = (videoId) => {
    ensureDbInitialized();
    validateId(videoId, 'videoId');

    try {
        if (!checkVideoExists(videoId)) {
            throw new Error(`Video ${videoId} does not exist`);
        }

        const tagsFromCache = tagsCache.get(videoId);

        if (tagsFromCache) {
            return tagsFromCache;
        } else {
            const stmt = db.prepare(`
            SELECT t.id, t.label, t.created_at
            FROM tags_videos tv
            JOIN tags t ON tv.tag_id = t.id
            WHERE tv.video_id =?
            `);
            const tags = stmt.all(videoId);
            const returnTags = tags.map((tag) => ({
                id: tag.id,
                label: tag.label,
            }));

            tagsCache.set(videoId, returnTags);
            return returnTags;
        }
    } catch (err) {
        throw new Error(`Failed to fetch tags for video ${videoId}: ${err.message}`);
    }
};

const getTagsByImageId = (imageId) => {
    ensureDbInitialized();
    validateId(imageId, 'imageId');

    try {
        if (!checkImageExists(imageId)) {
            throw new Error(`Image ${imageId} does not exist`);
        }

        const tagsFromCache = null; //tagsCache.get(imageId);

        if (tagsFromCache) {
            return tagsFromCache;
        } else {
            const stmt = db.prepare(`
            SELECT t.id, t.label, t.created_at
            FROM tags_images ti
            JOIN tags t ON ti.tag_id = t.id
            WHERE ti.image_id =?
            `);
            const tags = stmt.all(imageId);
            const returnTags = tags.map((tag) => ({
                id: tag.id,
                label: tag.label,
            }));

            tagsCache.set(imageId, returnTags);

            return returnTags;
        }
    } catch (err) {
        throw new Error(`Failed to fetch tags for image ${imageId}: ${err.message}`);
    }
};

const getAudioIdsByTag = (tagId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');

    try {
        if (!checkTagExists(tagId)) {
            throw new Error(`Tag ${tagId} does not exist`);
        }

        const stmt = db.prepare(`
                SELECT audios_id FROM tags_audios
                WHERE tag_id =?
                ORDER BY added_at ASC
            `);
        const audioIds = stmt.all(tagId).map((row) => row.image_id);

        return audioIds;
    } catch (err) {
        throw new Error(`Failed to fetch audio Ids for tag ${tagId}: ${err.message}`);
    }
};

/**
 * Associates an image with a tag.
 *
 * @param {string} tagId - Tag id.
 * @param {string} audioId - Image id.
 * @throws {Error} When validation fails, the tag/image does not exist, or insertion fails.
 * @returns {boolean} True when a new mapping was inserted.
 */
const addAudioToTag = (tagId, audioId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');
    validateId(audioId, 'audioId');

    try {
        const info = db.transaction(() => {
            if (!checkTagExists(tagId)) {
                throw new Error(`Tag ${tagId} does not exist`);
            }
            if (!checkAudioExists(audioId)) {
                throw new Error(`Audio ${audioId} does not exist`);
            }

            const existsStmt = db.prepare(`
                SELECT 1 FROM tags_audios WHERE tag_id =? AND audio_id =?
            `);
            if (existsStmt.get(tagId, audioId)) {
                return { changes: 0 };
            }

            const stmt = db.prepare(`
                INSERT INTO tags_audios (tag_id, audio_id, added_at)
                VALUES (?,?,?)
            `);
            const result = stmt.run(tagId, audioId, Date.now());

            if (result.changes > 0) {
                const tagIds = tagsCache.get(audioId) || [];
                tagIds.push(getTagById(tagId));
                tagsCache.set(audioId, tagIds);
            }

            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to add audio to tag ${tagId}: ${err.message}`);
    }
};

const getTagsByAudioId = (audioId) => {
    ensureDbInitialized();
    validateId(audioId, 'audioId');

    try {
        if (!checkAudioExists(audioId)) {
            throw new Error(`Audio ${audioId} does not exist`);
        }

        const tagsFromCache = null; //tagsCache.get(audioId);

        if (tagsFromCache) {
            return tagsFromCache;
        } else {
            const stmt = db.prepare(`
            SELECT t.id, t.label, t.created_at
            FROM tags_audios ti
            JOIN tags t ON ti.tag_id = t.id
            WHERE ti.audio_id =?
            `);
            const tags = stmt.all(audioId);
            const returnTags = tags.map((tag) => ({
                id: tag.id,
                label: tag.label,
            }));

            tagsCache.set(audioId, returnTags);

            return returnTags;
        }
    } catch (err) {
        throw new Error(`Failed to fetch tags for audio ${audioId}: ${err.message}`);
    }
};

/**
 * Removes an image-to-tag association.
 *
 * @param {string} tagId - Tag id.
 * @param {string} audioId - Image id.
 * @throws {Error} When validation fails, the tag/image does not exist, or deletion fails.
 * @returns {boolean} True when a mapping was removed.
 */
const removeAudioFromTag = (tagId, audioId) => {
    ensureDbInitialized();
    validateId(tagId, 'tagId');
    validateId(audioId, 'audioId');

    try {
        const info = db.transaction(() => {
            if (!checkTagExists(tagId)) {
                throw new Error(`Tag ${tagId} does not exist`);
            }
            if (!checkAudioExists(audioId)) {
                throw new Error(`Audio ${audioId} does not exist`);
            }

            const existsStmt = db.prepare(`
                SELECT 1 FROM tags_audios WHERE tag_id =? AND audio_id =?
            `);
            if (!existsStmt.get(tagId, audioId)) {
                return { changes: 0 };
            }

            const stmt = db.prepare('DELETE FROM tags_audios WHERE tag_id = ? AND audio_id =?');
            const result = stmt.run(tagId, audioId);

            if (result.changes > 0) {
                tagsCache.delete(audioId);
            }

            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to remove audio from tag ${tagId}: ${err.message}`);
    }
};
/**
 * Returns all tags.
 *
 * @returns {Array<{id: string, label: string}>|undefined} All tags, possibly from cache.
 */
const getTags = () => {
    ensureDbInitialized();

    const cached = tagsCache.get(CACHE_TAG_LABELS_KEY);

    if (cached) {
        return cached;
    }

    try {
        const stmt = db.prepare(`SELECT id, label FROM tags `);
        const results = stmt.all();
        const tagLabels = results.map((row) => ({ id: row.id, label: row.label }));
        tagsCache.set(CACHE_TAG_LABELS_KEY, tagLabels);
        return tagLabels;
    } catch (err) {
        console.error(`Failed to fetch tags from cache: ${err.message}`);
    }
};

/**
 * Returns a tag by id.
 *
 * @param {string} tagId - Tag id.
 * @returns {{id: string, label: string}|undefined} Tag object when found.
 */
const getTagById = (tagId) => {
    ensureDbInitialized();

    validateId(tagId, 'tagId');

    try {
        const stmt = db.prepare(`SELECT id, label FROM tags WHERE id =?`);
        const result = stmt.get(tagId);
        if (!result) {
            throw new Error(`Tag with ID ${tagId} does not exist`);
        }

        return { id: result.id, label: result.label };
    } catch (err) {
        console.error(`Failed to fetch tag by ID: ${err.message}`);
        return undefined;
    }
};

/**
 * Removes all tag associations for a video.
 *
 * @param {string} videoId - Video id.
 * @throws {Error} When validation fails or cleanup fails.
 * @returns {number} Number of removed mappings.
 */
const cleanupVideoFromTags = (videoId) => {
    ensureDbInitialized();
    validateId(videoId, 'videoId');

    try {
        const info = db.transaction(() => {
            const tagStmt = db.prepare(`
                SELECT tag_id FROM tags_videos WHERE video_id =?
                `);
            const tagIds = tagStmt.all(videoId).map((row) => row.tag_id);

            const deleteStmt = db.prepare('DELETE FROM tags_videos WHERE video_id =?');
            const result = deleteStmt.run(videoId);

            tagsCache.delete(videoId);
            return result;
        })();
        return info.changes;
    } catch (err) {
        throw new Error(`Failed to cleanup video from tags: ${err.message}`);
    }
};

/**
 * Clears the tags service cache.
 *
 * @returns {void}
 */
const clearTagsDbCache = () => {
    tagsCache.clear();
};

/**
 * Returns all video-tag mappings in a single query.
 * Used for bulk indexing to avoid N+1 queries per video.
 *
 * @returns {Object} Map of videoId → string[] of tag labels
 */
const getAllTagLabelsByVideoId = () => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT tv.video_id, t.label
            FROM tags_videos tv
            JOIN tags t ON t.id = tv.tag_id
            ORDER BY tv.video_id
        `);

        const rows = stmt.all();
        const map = {};

        for (const row of rows) {
            if (!map[row.video_id]) map[row.video_id] = [];
            map[row.video_id].push(row.label);
        }

        return map;
    } catch (err) {
        throw new Error(`Failed to fetch all tag labels by video: ${err.message}`);
    }
};

module.exports = {
    initializeDb,
    addTag,
    removeTagById,
    renameTagById,
    addVideoToTag,
    getVideoIdsByTag,
    getVideosByTag,
    removeVideoFromTag,
    getTagsByVideoId,
    getTags,
    getTagById,
    cleanupVideoFromTags,
    checkTagExists,
    clearTagsDbCache,
    getAllTagLabelsByVideoId,
    //images
    getImageIdsByTag,
    addImageToTag,
    removeImageFromTag,
    getTagsByImageId,
    // audio
    getAudioIdsByTag,
    getTagsByAudioId,
    addAudioToTag,
    removeAudioFromTag,
};
