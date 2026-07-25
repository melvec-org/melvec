const LRUCache = require('../service-utils/LRUCache');
const { getDb } = require('../database/database');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');

const CACHE_SIZE = 500;
const relatedVideosCache = new LRUCache(CACHE_SIZE);
let db = null;

// Ensure db is initialized
const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
};

const initializeDb = () => {
    db = getDb();
    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        relatedVideosCache.clear();
    });
    serviceEventBus.subscribe(interServiceEvents.DELETE_VIDEO, ({ videoId }) => {
        deleteRelatedVideos(videoId);
    });

    relatedVideosCache.clear();
};

// Validate video_id and related_video_ids
const validateVideoIds = (video_id, related_video_ids) => {
    if (!video_id || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }
    if (!Array.isArray(related_video_ids)) {
        throw new Error('Field related_video_ids must be an array');
    }
    if (related_video_ids[0]) {
        for (const id of related_video_ids) {
            if (typeof id !== 'string' || id.trim() === '') {
                throw new Error('Each related_video_id must be a non-empty string');
            }
        }
    }
};

// Check if video_id exists in videos table
const checkVideoExists = (video_id) => {
    const stmt = db.prepare('SELECT id FROM videos WHERE id = ?');
    return !!stmt.get(video_id);
};

// Add or update related videos for a video_id
const setRelatedVideos = (video_id, related_video_ids) => {
    ensureDbInitialized();
    validateVideoIds(video_id, related_video_ids);

    // Debug: Log inputs

    // Check if video_id and related_video_ids exist in videos table
    if (!checkVideoExists(video_id)) {
        throw new Error(`Video with video_id ${video_id} does not exist in videos table`);
    }
    for (const related_id of related_video_ids) {
        if (!checkVideoExists(related_id)) {
            // remove related_id from the related_videoIds
            related_video_ids = related_video_ids.filter((id) => id !== related_id);
        }
    }

    const related_video_id_json = JSON.stringify(related_video_ids);
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO related_videos (video_id, related_video_id)
        VALUES (?, ?)
    `);

    try {
        const info = db.transaction(() => {
            const result = stmt.run(video_id, related_video_id_json);

            if (result.changes > 0) {
                relatedVideosCache.set(video_id, related_video_ids);
            }
            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to set related videos for video ${video_id}: ${err.message}`);
    }
};

// Get related videos for a video_id
// Get related videos for a video_id
const getRelatedVideos = (video_id) => {
    ensureDbInitialized();
    if (!video_id || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Video ID must be a non-empty string');
    }

    const cached = relatedVideosCache.get(video_id);
    if (cached) {
        return cached;
    }

    try {
        const stmt = db.prepare('SELECT related_video_id FROM related_videos WHERE video_id = ?');
        const result = stmt.get(video_id);
        if (result && result.related_video_id) {
            try {
                const related_video_ids = JSON.parse(result.related_video_id);
                if (!Array.isArray(related_video_ids)) {
                    throw new Error('Invalid related videos format: not an array');
                }
                relatedVideosCache.set(video_id, related_video_ids);
                return related_video_ids;
            } catch (parseErr) {
                console.error(`Error parsing related_video_id for video ${video_id}: ${parseErr.message}`);
                return [];
            }
        }
        return [];
    } catch (err) {
        throw new Error(`Error fetching related videos for video ${video_id}: ${err.message}`);
    }
};

// Delete related videos for a video_id
// Delete related videos for a video_id and remove references from other videos
const deleteRelatedVideos = (video_id) => {
    ensureDbInitialized();
    if (!video_id || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }

    try {
        const info = db.transaction(() => {
            // Delete the row for this video_id
            const deleteStmt = db.prepare('DELETE FROM related_videos WHERE video_id = ?');
            const deleteResult = deleteStmt.run(video_id);

            if (deleteResult.changes > 0) {
                relatedVideosCache.delete(video_id);
            }

            // Find rows where video_id appears in related_video_id
            const searchStmt = db.prepare('SELECT video_id, related_video_id FROM related_videos WHERE related_video_id LIKE ?');
            const rows = searchStmt.all(`%"${video_id}"%`);

            const updateStmt = db.prepare('UPDATE related_videos SET related_video_id = ? WHERE video_id = ?');
            const deleteEmptyStmt = db.prepare('DELETE FROM related_videos WHERE video_id = ?');

            let referenceUpdates = 0;
            for (const row of rows) {
                try {
                    const relatedVideos = JSON.parse(row.related_video_id);
                    if (!Array.isArray(relatedVideos)) {
                        console.warn(`Invalid related_video_id format for video_id ${row.video_id}, skipping`);
                        continue;
                    }

                    // Remove video_id from the array
                    const updatedVideos = relatedVideos.filter((id) => id !== video_id);
                    if (updatedVideos.length === relatedVideos.length) {
                        continue; // video_id not found
                    }

                    if (updatedVideos.length > 0) {
                        // Update row with new array
                        const updatedJson = JSON.stringify(updatedVideos);
                        const updateResult = updateStmt.run(updatedJson, row.video_id);

                        if (updateResult.changes > 0) {
                            relatedVideosCache.set(row.video_id, updatedVideos);

                            referenceUpdates += updateResult.changes;
                        }
                    } else {
                        // Delete row if array is empty
                        const deleteResult = deleteEmptyStmt.run(row.video_id);

                        if (deleteResult.changes > 0) {
                            relatedVideosCache.delete(row.video_id);

                            referenceUpdates += deleteResult.changes;
                        }
                    }
                } catch (parseErr) {
                    console.error(`Error parsing related_video_id for video ${row.video_id}: ${parseErr.message}`);
                }
            }

            return { primaryChanges: deleteResult.changes, referenceUpdates };
        })();

        return info.primaryChanges > 0 || info.referenceUpdates > 0;
    } catch (err) {
        throw new Error(`Failed to delete related videos for video ${video_id}: ${err.message}`);
    }
};

module.exports = {
    initializeDb,
    setRelatedVideos,
    getRelatedVideos,
    deleteRelatedVideos,
};
