const { getDb } = require('./database');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');

let db = null;

const initializeDb = () => {
    db = getDb();
    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
    });
};

const ensureDbInitialized = () => {
    if (!db) throw new Error('smartPlaylistsDbService: database not initialized.');
    return db;
};

/**
 * Replace all video IDs for a given playlist key in a single transaction.
 * Doing a full REPLACE rather than diffing keeps the caller simple.
 *
 * @param {string}   key      - e.g. 'leastPlayedVideos'
 * @param {string[]} videoIds - ordered array of video IDs
 */
const setPlaylist = (key, videoIds) => {
    ensureDbInitialized();
    const del = db.prepare('DELETE FROM smart_playlist_videos WHERE playlist_id = ?');
    const ins = db.prepare('INSERT INTO smart_playlist_videos (playlist_id, video_id, order_index) VALUES (?, ?, ?)');

    db.transaction(() => {
        del.run(key);
        videoIds.forEach((id, idx) => ins.run(key, id, idx));
    })();
};

/**
 * Persist multiple playlists at once (one transaction).
 *
 * @param {Object.<string, string[]>} data - e.g. { leastPlayedVideos: [...], ... }
 */
const setPlaylists = (data) => {
    ensureDbInitialized();
    const del = db.prepare('DELETE FROM smart_playlist_videos WHERE playlist_id = ?');
    const ins = db.prepare('INSERT INTO smart_playlist_videos (playlist_id, video_id, order_index) VALUES (?, ?, ?)');

    db.transaction(() => {
        for (const [key, videoIds] of Object.entries(data)) {
            del.run(key);
            videoIds.forEach((id, idx) => ins.run(key, id, idx));
        }
    })();
};

/**
 * Returns all smart playlists as { [key]: string[] } ordered by order_index.
 */
const getAllPlaylists = () => {
    ensureDbInitialized();
    const rows = db.prepare('SELECT playlist_id, video_id FROM smart_playlist_videos ORDER BY playlist_id, order_index ASC').all();
    const result = {};
    for (const row of rows) {
        if (!result[row.playlist_id]) result[row.playlist_id] = [];
        result[row.playlist_id].push(row.video_id);
    }
    return result;
};

/**
 * Returns the video IDs for a single playlist key.
 *
 * @param {string} key
 * @returns {string[]}
 */
const getPlaylist = (key) => {
    ensureDbInitialized();
    return db
        .prepare('SELECT video_id FROM smart_playlist_videos WHERE playlist_id = ? ORDER BY order_index ASC')
        .all(key)
        .map((r) => r.video_id);
};

// NOTE: No removeVideoFromAllPlaylists needed here.
// The FOREIGN KEY ... ON DELETE CASCADE on smart_playlist_videos.video_id
// means SQLite removes the rows automatically when the video is deleted
// from the videos table.

module.exports = {
    initializeDb,
    setPlaylist,
    setPlaylists,
    getAllPlaylists,
    getPlaylist,
};
