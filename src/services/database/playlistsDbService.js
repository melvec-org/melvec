const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { getDb } = require('./database');
const { checkVideoExists } = require('../database/videoLibraryDbService');

const CACHE_SIZE = 100;

const playlistsCache = new LRUCache(CACHE_SIZE);
const CACHE_PLAYLIST_LABELS_KEY = '__cache_playlist_labels__';
let db = null;

const initializeDb = () => {
    db = getDb();
    playlistsCache.clear();

    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        playlistsCache.clear();
    });
};

const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
};

// Validate playlist name
const validatePlaylistName = (name) => {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new Error('Field name must be a non-empty string');
    }
};

// Validate ID
const validateId = (id, fieldName) => {
    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error(`Field ${fieldName} must be a non-empty string`);
    }
};

// Check if playlist exists
const checkPlaylistExists = (playlistId) => {
    ensureDbInitialized();
    if (playlistsCache.get(playlistId)) return true;

    const stmt = db.prepare('SELECT id FROM playlists WHERE id = ?');
    return !!stmt.get(playlistId);
};

const checkPlaylistExistsByLabel = (label) => {
    ensureDbInitialized();
    if (playlistsCache.get(CACHE_PLAYLIST_LABELS_KEY)) {
        return playlistsCache.get(CACHE_PLAYLIST_LABELS_KEY).find((item) => item.label === label);
    }

    const stmt = db.prepare('SELECT label FROM playlists');
    const rows = stmt.all();

    const playlistLabels = rows.map((row) => row.label);

    if (playlistLabels.includes(label)) return true;
    return false;
};

// Add a playlist
const addPlaylist = (id, label) => {
    ensureDbInitialized();
    validatePlaylistName(label);
    validateId(id, 'playlistId');
    const playlistId = id;
    const createdAt = Date.now();

    // check for duplicate entry by checking label should not be same
    // if duplicate entry found do nothing and return without adding new entry
    if (checkPlaylistExistsByLabel(label)) return;

    const stmt = db.prepare(`
         INSERT INTO playlists (id, label, created_at)
         VALUES (?, ?, ?)
     `);

    try {
        const info = db.transaction(() => {
            const result = stmt.run(playlistId, label, createdAt);
            if (result.changes > 0) {
                playlistsCache.set(playlistId, []);
                playlistsCache.delete(CACHE_PLAYLIST_LABELS_KEY);
            }
            return result;
        })();

        return { id: playlistId, label, created_at: createdAt };
    } catch (err) {
        throw new Error(`Failed to add playlist ${label}: ${err.message}`);
    }
};

// Remove a playlist
const removePlaylistById = (playlistId) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');

    try {
        const info = db.transaction(() => {
            const stmt = db.prepare('DELETE FROM playlists WHERE id = ?');
            const result = stmt.run(playlistId);
            if (result.changes > 0) {
                playlistsCache.delete(playlistId);
                playlistsCache.delete(CACHE_PLAYLIST_LABELS_KEY);
            }
            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to remove playlist ${playlistId}: ${err.message}`);
    }
};

const renamePlaylistById = (playlistId, newLabel) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');
    validatePlaylistName(newLabel);

    try {
        const info = db.transaction(() => {
            const stmt = db.prepare('UPDATE playlists SET label =? WHERE id =?');
            const result = stmt.run(newLabel, playlistId);

            if (result.changes > 0) {
                playlistsCache.delete(playlistId);
                playlistsCache.delete(CACHE_PLAYLIST_LABELS_KEY);
            }
            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to rename playlist ${playlistId}: ${err.message}`);
    }
};

// Get video IDs by playlist
const getVideoIdsByPlaylist = (playlistId) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');

    try {
        if (!checkPlaylistExists(playlistId)) {
            throw new Error(`Playlist ${playlistId} does not exist`);
        }

        let videoIds = playlistsCache.get(playlistId);
        if (!videoIds) {
            const stmt = db.prepare(`
                SELECT video_id, order_index FROM playlists_videos
                WHERE playlist_id = ?
                ORDER BY order_index ASC
            `);

            videoIds = stmt.all(playlistId).map((row) => {
                return row.video_id;
            });
            playlistsCache.set(playlistId, videoIds);
        }

        return videoIds;
    } catch (err) {
        throw new Error(`Failed to fetch video IDs for playlist ${playlistId}: ${err.message}`);
    }
};

// Get videos by playlist
const getVideosByPlaylist = (playlistId) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');

    try {
        if (!checkPlaylistExists(playlistId)) {
            throw new Error(`Playlist ${playlistId} does not exist`);
        }

        let videoIds = playlistsCache.get(playlistId);
        if (!videoIds) {
            const stmt = db.prepare(`
                SELECT video_id FROM playlists_videos
                WHERE playlist_id = ?
                ORDER BY order_index ASC
            `);
            videoIds = stmt.all(playlistId).map((row) => row.video_id);
            playlistsCache.set(playlistId, videoIds);
        }

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
        // Maintain order based on videoIds
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
        throw new Error(`Failed to fetch videos for playlist ${playlistId}: ${err.message}`);
    }
};

const addVideoToPlaylist = (playlistId, videoId) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');
    validateId(videoId, 'videoId');

    try {
        const info = db.transaction(() => {
            if (!checkPlaylistExists(playlistId)) {
                throw new Error(`Playlist ${playlistId} does not exist`);
            }
            if (!checkVideoExists(videoId)) {
                throw new Error(`Video ${videoId} does not exist`);
            }

            // Check if video already in playlist
            const existsStmt = db.prepare(`
                SELECT 1 FROM playlists_videos WHERE playlist_id = ? AND video_id = ?
            `);
            if (existsStmt.get(playlistId, videoId)) {
                return { changes: 0 };
            }

            const getMaxOrderStmt = db.prepare(`
                SELECT COALESCE(MAX(order_index), -1) AS max_order
                FROM playlists_videos WHERE playlist_id = ?
            `);
            const { max_order } = getMaxOrderStmt.get(playlistId);
            const nextOrderIndex = max_order + 1;

            const stmt = db.prepare(`
                INSERT INTO playlists_videos (playlist_id, video_id, order_index)
                VALUES (?, ?, ?)
            `);
            const result = stmt.run(playlistId, videoId, nextOrderIndex);

            if (result.changes > 0) {
                const videoIds = playlistsCache.get(playlistId) || [];
                if (!videoIds.includes(videoId)) {
                    videoIds.push(videoId);
                    playlistsCache.set(playlistId, videoIds);
                    playlistsCache.delete(CACHE_PLAYLIST_LABELS_KEY);
                }
            }
            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to add video ${videoId} to playlist ${playlistId}: ${err.message}`);
    }
};

// add multiple videos to a playlist
const addMultipleVideosToPlaylist = (playlistId, videoIds) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');

    try {
        if (!checkPlaylistExists(playlistId)) {
            throw new Error(`Playlist ${playlistId} does not exist`);
        }

        // Filter out invalid IDs early
        const validVideoIds = videoIds.filter((id) => typeof id === 'string' && id.trim() !== '');
        if (validVideoIds.length === 0) {
            throw new Error('No valid video IDs provided.');
        }

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO playlists_videos (playlist_id, video_id,order_index)
            VALUES (?, ?, ?)
        `);

        const info = db.transaction((ids) => {
            const addedIds = [];

            const getMaxOrderStmt = db.prepare(`
                SELECT COALESCE(MAX(order_index), -1) AS max_order
                FROM playlists_videos WHERE playlist_id = ?
            `);
            let { max_order } = getMaxOrderStmt.get(playlistId);

            for (const videoId of ids) {
                if (!checkVideoExists(videoId)) {
                    console.warn(`Video ${videoId} does not exist, skipping.`);
                    continue;
                }
                const nextOrderIndex = ++max_order;

                stmt.run(playlistId, videoId, nextOrderIndex);
                addedIds.push(videoId);
            }

            // Update cache for playlist
            const cachedVideos = playlistsCache.get(playlistId) || [];
            const newCache = [...new Set([...cachedVideos, ...addedIds])];
            playlistsCache.set(playlistId, newCache);
            playlistsCache.delete(CACHE_PLAYLIST_LABELS_KEY);

            return addedIds.length;
        })(validVideoIds);

        return info > 0;
    } catch (err) {
        throw new Error(`Failed to add multiple videos to playlist ${playlistId}: ${err.message}`);
    }
};

const removeVideoFromPlaylist = (playlistId, videoId) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');
    validateId(videoId, 'videoId');

    try {
        const info = db.transaction(() => {
            if (!checkPlaylistExists(playlistId)) {
                throw new Error(`Playlist ${playlistId} does not exist`);
            }
            if (!checkVideoExists(videoId)) {
                throw new Error(`Video ${videoId} does not exist`);
            }

            const stmt = db.prepare(`
                DELETE FROM playlists_videos WHERE playlist_id = ? AND video_id = ?
            `);
            const result = stmt.run(playlistId, videoId);

            if (result.changes > 0) {
                const videoIds = playlistsCache.get(playlistId) || [];
                const updatedIds = videoIds.filter((id) => id !== videoId);
                playlistsCache.set(playlistId, updatedIds);
                playlistsCache.delete(CACHE_PLAYLIST_LABELS_KEY);
            }
            return result;
        })();

        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to remove video ${videoId} from playlist ${playlistId}: ${err.message}`);
    }
};

// Get playlists by video ID
const getPlaylistsByVideoId = (videoId) => {
    ensureDbInitialized();
    validateId(videoId, 'videoId');

    try {
        if (!checkVideoExists(videoId)) {
            throw new Error(`Video ${videoId} does not exist`);
        }

        const stmt = db.prepare(`
            SELECT p.id, p.label, p.created_at
            FROM playlists_videos pv
            JOIN playlists p ON pv.playlist_id = p.id
            WHERE pv.video_id = ?
        `);
        const playlists = stmt.all(videoId);

        return playlists.map((playlist) => ({
            id: playlist.id,
            label: playlist.label,
            created_at: playlist.created_at,
        }));
    } catch (err) {
        throw new Error(`Failed to fetch playlists for video ${videoId}: ${err.message}`);
    }
};

// Get all playlist names and IDs
const getPlaylists = () => {
    ensureDbInitialized();

    const cached = playlistsCache.get(CACHE_PLAYLIST_LABELS_KEY);
    if (cached) {
        return cached;
    }

    try {
        const stmt = db.prepare('SELECT id, label FROM playlists');
        const results = stmt.all();
        const playlistLabels = results.map((row) => ({ id: row.id, label: row.label }));
        playlistsCache.set(CACHE_PLAYLIST_LABELS_KEY, playlistLabels);

        return playlistLabels;
    } catch (err) {
        throw new Error(`Error fetching playlist labels: ${err.message}`);
    }
};

const getPlaylistById = (playlistId) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');

    try {
        const stmt = db.prepare(`
            SELECT id, label FROM playlists WHERE id = ?
        `);
        const playlist = stmt.get(playlistId);

        if (!playlist) {
            throw new Error(`Playlist with ID ${playlistId} does not exist`);
        }

        return { id: playlist.id, label: playlist.label };
    } catch (err) {
        throw new Error(`Failed to fetch playlist by ID ${playlistId}: ${err.message}`);
    }
};

// Cleanup video from all playlists
const cleanupVideoFromPlaylists = (videoId) => {
    ensureDbInitialized();
    validateId(videoId, 'videoId');

    try {
        const info = db.transaction(() => {
            // Find affected playlists
            const playlistStmt = db.prepare(`
                SELECT playlist_id FROM playlists_videos WHERE video_id = ?
            `);
            const playlistIds = playlistStmt.all(videoId).map((row) => row.playlist_id);

            // Delete rows
            const deleteStmt = db.prepare(`
                DELETE FROM playlists_videos WHERE video_id = ?
            `);
            const result = deleteStmt.run(videoId);

            // Update cache for affected playlists
            playlistIds.forEach((playlistId) => {
                const videoIds = playlistsCache.get(playlistId) || [];
                const updatedIds = videoIds.filter((id) => id !== videoId);
                playlistsCache.set(playlistId, updatedIds);
            });

            return result;
        })();
        return info.changes;
    } catch (err) {
        throw new Error(`Failed to cleanup video ${videoId} from playlists: ${err.message}`);
    }
};

const clearPlaylistDbCache = () => {
    playlistsCache.clear();
};

const updateVideoOrderInPlaylist = (playlistId, orderedVideoIds) => {
    ensureDbInitialized();
    validateId(playlistId, 'playlistId');

    try {
        const stmt = db.prepare(`
            UPDATE playlists_videos
            SET order_index = ?
            WHERE playlist_id = ? AND video_id = ?
        `);

        const transaction = db.transaction((ids) => {
            ids.forEach((videoId, index) => {
                stmt.run(index, playlistId, videoId);
            });
        });

        transaction(orderedVideoIds);

        playlistsCache.set(playlistId, orderedVideoIds);
        return {
            success: true,
            message: `Video order updated successfully for playlist ${playlistId}`,
        };
    } catch (err) {
        throw new Error(`Failed to update order for playlist ${playlistId}: ${err.message}`);
    }
};

/**
 * Returns all video-playlist mappings in a single query.
 * Used for bulk indexing to avoid N+1 queries per video.
 *
 * @returns {Object} Map of videoId → string[] of playlist labels
 */
const getAllPlaylistLabelsByVideoId = () => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT pv.video_id, p.label
            FROM playlists_videos pv
            JOIN playlists p ON p.id = pv.playlist_id
            ORDER BY pv.video_id
        `);

        const rows = stmt.all();
        const map = {};

        for (const row of rows) {
            if (!map[row.video_id]) map[row.video_id] = [];
            map[row.video_id].push(row.label);
        }

        return map;
    } catch (err) {
        throw new Error(`Failed to fetch all playlist labels by video: ${err.message}`);
    }
};

module.exports = {
    initializeDb,
    addPlaylist,
    removePlaylistById,
    renamePlaylistById,
    getVideosByPlaylist,
    getVideoIdsByPlaylist,
    addVideoToPlaylist,
    addMultipleVideosToPlaylist,
    removeVideoFromPlaylist,
    getPlaylistsByVideoId,
    getPlaylists,
    getPlaylistById,
    cleanupVideoFromPlaylists,
    checkPlaylistExists,
    clearPlaylistDbCache,
    updateVideoOrderInPlaylist,
    getAllPlaylistLabelsByVideoId,
};
