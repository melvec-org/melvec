// Oganisations contain tags, playlists, smartplaylists

const createTables = (db) => {
    const tagsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'").get();
    if (!tagsTableExists) {
        db.exec(`
            CREATE TABLE tags (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        `);
    }

    const tagsVideosTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags_videos'").get();
    if (!tagsVideosTableExists) {
        db.exec(`
            CREATE TABLE tags_videos (
                tag_id TEXT NOT NULL,
                video_id TEXT NOT NULL,
                added_at INTEGER NOT NULL,
                PRIMARY KEY (tag_id, video_id),
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        `);
    }

    // Create playlists table
    const playlistsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='playlists'").get();
    if (!playlistsTableExists) {
        db.exec(`
            CREATE TABLE playlists (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        `);
    }

    // Create playlist_videos junction table
    const playlistsVideosTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='playlists_videos'").get();
    if (!playlistsVideosTableExists) {
        db.exec(`
         CREATE TABLE playlists_videos (
             playlist_id TEXT NOT NULL,
             video_id TEXT NOT NULL,
             order_index INTEGER NOT NULL DEFAULT 0,
             PRIMARY KEY (playlist_id, video_id),
             FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
             FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
         )
     `);
    }

    // smart_playlist_videos table — one row per (playlist, video).
    // ON DELETE CASCADE means removing a video from the library automatically
    // cleans it from every smart playlist with no application code.
    const smartPlaylistVideosTableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='smart_playlist_videos'")
        .get();
    if (!smartPlaylistVideosTableExists) {
        db.exec(`
            CREATE TABLE smart_playlist_videos (
                playlist_id  TEXT    NOT NULL,
                video_id      TEXT    NOT NULL,
                order_index   INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (playlist_id, video_id),
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        `);
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_smart_playlist_videos_key
                ON smart_playlist_videos(playlist_id, order_index)
        `);
    }

    const videoCategoriesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_categories'").get();
    if (!videoCategoriesTableExists) {
        db.exec(`
            CREATE TABLE video_categories (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                description TEXT DEFAULT ''
            )
        `);
    }
};
const createIndexes = (db) => {};

module.exports = {
    createTables,
    createIndexes,
};
