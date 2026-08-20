const Database = require('better-sqlite3');
const { getDbPath, dbFileNames } = require('../servicePathConfig');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { doesDirectoryExist } = require('../service-utils/fileUtils');
const path = require('path');
const fs = require('fs');
const { respondSuccess, respondError } = require('../service-utils/sendToUI');

let videoLibraryDbPath = '';
let db = null;

const initializeDatabase = (dbFileName = dbFileNames.VIDEO_LIBRARY) => {
    videoLibraryDbPath = getDbPath(dbFileName);

    // Close existing connection if open
    if (db) {
        try {
            db.close();
        } catch (err) {
            throw new Error(`Error closing existing database: ${err.message}`);
        }
    }

    // Open new connection
    try {
        db = new Database(videoLibraryDbPath);
    } catch (err) {
        throw new Error(`Failed to initialize database: ${err.message}`);
    }

    // Configure database
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -20000'); // 20MB cache

    // Create tables if they don't exist
    createTables();
    // create indexes for faster lookup
    createIndexes();

    serviceEventBus.publish(interServiceEvents.DATABASE_INITIALIZED, {
        db: db,
    });

    serviceEventBus.subscribe(interServiceEvents.BEFORE_APP_QUIT, () => {
        closeDatabase();
    });

    return db;
};

const createTables = () => {
    // collections table
    const collectionsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='collections'").get();
    if (!collectionsTableExists) {
        const createCollectionsTable = `
         CREATE TABLE collections (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            year INTEGER NOT NULL,
            isHidden INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT unique_year_label UNIQUE (year, label)
         )
     `;
        db.exec(createCollectionsTable);
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

    // videos table
    const videosTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='videos'").get();
    if (!videosTableExists) {
        const createVideosTable = `
            CREATE TABLE videos (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                birthtimeMs INTEGER NOT NULL,
                collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE RESTRICT,
                category_id TEXT REFERENCES video_categories(id) ON DELETE SET NULL,
                year INTEGER NOT NULL,
                title TEXT NOT NULL,
                size INTEGER NOT NULL,
                duration REAL NOT NULL,
                latitude REAL NOT NULL DEFAULT 0.0,
                longitude REAL NOT NULL DEFAULT 0.0,
                source TEXT NOT NULL DEFAULT 'local',
                is_nsfw INTEGER NOT NULL DEFAULT 0 CHECK (is_nsfw IN (0, 1)),
                has_preview INTEGER NOT NULL DEFAULT 0 CHECK (has_preview IN (0, 1))
            )
        `;
        db.exec(createVideosTable);
    }

    // video_metrics table
    const videoMetricsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_metrics'").get();
    if (!videoMetricsTableExists) {
        const createMetadataTable = `
            CREATE TABLE video_metrics (
                video_id TEXT PRIMARY KEY,
                views INTEGER NOT NULL DEFAULT 0,
                rating INTEGER NOT NULL DEFAULT 0,
                content_quality INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        `;
        db.exec(createMetadataTable);
    }

    // Related_videos table
    const relatedVideosTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='related_videos'").get();
    if (!relatedVideosTableExists) {
        const createRelatedVideosTable = `
            CREATE TABLE related_videos (
                video_id TEXT PRIMARY KEY,
                related_video_id TEXT NOT NULL,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        `;
        db.exec(createRelatedVideosTable);
    }

    // Search_history table
    const searchHistoryTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='search_history'").get();
    if (!searchHistoryTableExists) {
        const createSearchHistoryTable = `
         CREATE TABLE search_history (
            id INTEGER PRIMARY KEY,
            label TEXT NOT NULL,
            occurrence INTEGER NOT NULL,
            last_searched_at INTEGER NOT NULL
         )
     `;
        db.exec(createSearchHistoryTable);
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

    const imagesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='images'").get();
    if (!imagesTableExists) {
        db.exec(`
            CREATE TABLE images (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                role TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                birthtimeMs INTEGER NOT NULL,
                size INTEGER NOT NULL,
                latitude REAL NOT NULL DEFAULT 0.0,
                longitude REAL NOT NULL DEFAULT 0.0,
                description TEXT CHECK(length(description) <= 1000),
                embedding BLOB,
                
                source TEXT NOT NULL DEFAULT 'local',
                is_nsfw INTEGER NOT NULL DEFAULT 0 CHECK (is_nsfw IN (0, 1)),
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE RESTRICT
            )
        `);
    }

    const imageVideosTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='image_videos'").get();
    if (!imageVideosTableExists) {
        db.exec(`
            CREATE TABLE image_videos (
                image_id TEXT NOT NULL,
                video_id TEXT NOT NULL,
                PRIMARY KEY (image_id, video_id),
                FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        `);
    }

    const tagsImagesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags_images'").get();
    if (!tagsImagesTableExists) {
        db.exec(`
            CREATE TABLE tags_images (
                tag_id TEXT NOT NULL,
                image_id TEXT NOT NULL,
                added_at INTEGER NOT NULL,
                PRIMARY KEY (tag_id, image_id),
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
            )
        `);
    }

    const audiosTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audios'").get();
    if (!audiosTableExists) {
        db.exec(`
            CREATE TABLE audios (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                role TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                birthtimeMs INTEGER NOT NULL,
                size INTEGER NOT NULL,
                duration REAL,
                description TEXT CHECK(length(description) <= 1000),
                embedding BLOB,
                source TEXT NOT NULL DEFAULT 'local',
                is_nsfw INTEGER NOT NULL DEFAULT 0 CHECK (is_nsfw IN (0, 1)),
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE RESTRICT
            )
        `);
    }

    const audioVideosTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audio_videos'").get();
    if (!audioVideosTableExists) {
        db.exec(`
            CREATE TABLE audio_videos (
                audio_id TEXT NOT NULL,
                video_id TEXT NOT NULL,
                PRIMARY KEY (audio_id, video_id),
                FOREIGN KEY (audio_id) REFERENCES audios(id) ON DELETE CASCADE,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        `);
    }

    const tagsAudiosTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags_audios'").get();
    if (!tagsAudiosTableExists) {
        db.exec(`
            CREATE TABLE tags_audios (
                tag_id TEXT NOT NULL,
                audio_id TEXT NOT NULL,
                added_at INTEGER NOT NULL,
                PRIMARY KEY (tag_id, audio_id),
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                FOREIGN KEY (audio_id) REFERENCES audios(id) ON DELETE CASCADE
            )
        `);
    }

    // Additional video metadata about it contents
    const videoMetaDataTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_metadata'").get();

    if (!videoMetaDataTableExists) {
        db.exec(`
            CREATE TABLE video_metadata (
                video_id TEXT NOT NULL
                                REFERENCES videos(id) ON DELETE CASCADE,

                description         TEXT CHECK(length(description) <= 2000),
                description_source  TEXT,

                normalized_description  TEXT,
                description_embedding   BLOB,

                transcript          TEXT CHECK(length(transcript) <= 50000),
                transcript_source   TEXT,

                updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            );
        `);
    }

    // watch_folders table
    const watchFoldersTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_folders'").get();
    if (!watchFoldersTableExists) {
        db.exec(`
            CREATE TABLE watch_folders (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL
            )
        `);
    }

    // watch_folders table
    const vocabularyTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vocabulary'").get();
    if (!vocabularyTableExists) {
        db.exec(`
            CREATE TABLE vocabulary (
                term TEXT PRIMARY KEY
                
            )
        `);
    }

    // watch_folder_media table
    const watchFolderMediaTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_folder_media'").get();
    if (!watchFolderMediaTableExists) {
        db.exec(`
            CREATE TABLE watch_folder_media (
                id TEXT PRIMARY KEY,
                watch_folder_id TEXT NOT NULL,
                path TEXT NOT NULL,
                name TEXT NOT NULL,
                birthtimeMs INTEGER NOT NULL,
                year INTEGER NOT NULL,
                size INTEGER NOT NULL,
                media_type TEXT NOT NULL,
                duration REAL,
                UNIQUE (watch_folder_id, path),
                FOREIGN KEY (watch_folder_id) REFERENCES watch_folders(id) ON DELETE CASCADE
            )
        `);
    }

    const locationClusterTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='location_clusters'").get();

    if (!locationClusterTableExists) {
        db.exec(`
            CREATE TABLE location_clusters (
                id INTEGER PRIMARY KEY,
                reference_id INTEGER UNIQUE,
                name TEXT NOT NULL,
                aliases TEXT,
                center_lat REAL NOT NULL,
                center_lon REAL NOT NULL,
                radius INTEGER NOT NULL
            );
    `);
    }

    const imageLocationClusterTableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='image_location_clusters'")
        .get();

    if (!imageLocationClusterTableExists) {
        db.exec(`
        CREATE TABLE image_location_clusters (
            image_id TEXT NOT NULL,
            cluster_id INTEGER NOT NULL,
            confidence REAL NOT NULL DEFAULT 1,

            PRIMARY KEY (image_id, cluster_id),

            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
            FOREIGN KEY (cluster_id) REFERENCES location_clusters(id) ON DELETE CASCADE
        );
    `);
    }

    const videoLocationClusterTableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_location_clusters'")
        .get();

    if (!videoLocationClusterTableExists) {
        db.exec(`
        CREATE TABLE video_location_clusters (
            video_id TEXT NOT NULL,
            cluster_id INTEGER NOT NULL,
            confidence REAL NOT NULL DEFAULT 1,

            PRIMARY KEY (video_id, cluster_id),

            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
            FOREIGN KEY (cluster_id) REFERENCES location_clusters(id) ON DELETE CASCADE
        );
    `);
    }

    // FTS table for full-text search
    const ftsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='videos_fts'").get();
    if (!ftsTableExists) {
        db.exec(`
            CREATE VIRTUAL TABLE videos_fts USING FTS5(
                video_id UNINDEXED,
                title UNINDEXED,
                description,
                transcript,
                tokenize='unicode61 remove_diacritics 2',
                prefix='2 3 4',
                detail='full'
            );

            CREATE TRIGGER IF NOT EXISTS fts_insert_video AFTER INSERT ON videos
            BEGIN
                INSERT INTO videos_fts(video_id, title) VALUES (new.id, new.title);
            END;

            CREATE TRIGGER IF NOT EXISTS fts_delete_video AFTER DELETE ON videos
            BEGIN
                DELETE FROM videos_fts WHERE video_id = old.id;
            END;

            CREATE TRIGGER IF NOT EXISTS fts_update_video AFTER UPDATE ON videos
            BEGIN
                UPDATE videos_fts SET title = new.title WHERE video_id = new.id;
            END;

            CREATE TRIGGER IF NOT EXISTS fts_insert_desc AFTER INSERT ON video_metadata
            BEGIN
                UPDATE videos_fts
                SET description = new.description,
                    transcript = new.transcript
                WHERE video_id = new.video_id;
            END;

            CREATE TRIGGER IF NOT EXISTS fts_delete_desc AFTER DELETE ON video_metadata
            BEGIN
                UPDATE videos_fts
                SET description = NULL,
                    transcript = NULL
                WHERE video_id = old.video_id;
            END;

            CREATE TRIGGER IF NOT EXISTS fts_update_desc AFTER UPDATE ON video_metadata
            BEGIN
                UPDATE videos_fts
                SET description = new.description,
                    transcript = new.transcript
                WHERE video_id = new.video_id;
            END;
        `);
    }

    // FTS table for image description full-text search
    const imagesFtsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='images_fts'").get();
    if (!imagesFtsTableExists) {
        db.exec(`
            CREATE VIRTUAL TABLE images_fts USING FTS5(
                image_id UNINDEXED,
                title UNINDEXED,
                description,
                tokenize='unicode61 remove_diacritics 2',
                prefix='2 3 4',
                detail='full'
            );

            CREATE TRIGGER IF NOT EXISTS fts_insert_image AFTER INSERT ON images
            BEGIN
                INSERT INTO images_fts(image_id, title, description)
                VALUES (new.id, new.title, new.description);
            END;

            CREATE TRIGGER IF NOT EXISTS fts_delete_image AFTER DELETE ON images
            BEGIN
                DELETE FROM images_fts WHERE image_id = old.id;
            END;

            CREATE TRIGGER IF NOT EXISTS fts_update_image AFTER UPDATE ON images
            BEGIN
                UPDATE images_fts
                SET title = new.title,
                    description = new.description
                WHERE image_id = new.id;
            END;
        `);
    }

    // FTS table for audio description full-text search
    const audiosFtsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audios_fts'").get();
    if (!audiosFtsTableExists) {
        db.exec(`
            CREATE VIRTUAL TABLE audios_fts USING FTS5(
                audio_id UNINDEXED,
                title UNINDEXED,
                description,
                tokenize='unicode61 remove_diacritics 2',
                prefix='2 3 4',
                detail='full'
            );

            CREATE TRIGGER IF NOT EXISTS fts_insert_audio AFTER INSERT ON audios
            BEGIN
                INSERT INTO audios_fts(audio_id, title, description)
                VALUES (new.id, new.title, new.description);
            END;

            CREATE TRIGGER IF NOT EXISTS fts_delete_audio AFTER DELETE ON audios
            BEGIN
                DELETE FROM audios_fts WHERE audio_id = old.id;
            END;

            CREATE TRIGGER IF NOT EXISTS fts_update_audio AFTER UPDATE ON audios
            BEGIN
                UPDATE audios_fts
                SET title = new.title,
                    description = new.description
                WHERE audio_id = new.id;
            END;
        `);
    }

    // safety checks
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS prevent_delete_nonempty_collection
        BEFORE DELETE ON collections
        FOR EACH ROW
        WHEN (SELECT COUNT(*) FROM videos WHERE collection_id = OLD.id) > 0
        BEGIN
            SELECT RAISE(ABORT, 'Cannot delete collection: it still contains videos. Move or delete the videos first.');
        END;
    `);
};

const createIndexes = () => {
    db.exec(`
        -- Fast lookup: all videos in a collection
        
        -- Fast filtering of hidden collections
        CREATE INDEX IF NOT EXISTS idx_collections_hidden 
            ON collections(isHidden);

        -- Fast playlist and tag lookups
        CREATE INDEX IF NOT EXISTS idx_playlists_videos_playlist_id 
            ON playlists_videos(playlist_id);

        CREATE INDEX IF NOT EXISTS idx_tags_videos_tag_id 
            ON tags_videos(tag_id);

        CREATE INDEX IF NOT EXISTS idx_tags_videos_video_id 
            ON tags_videos(video_id);

        CREATE INDEX IF NOT EXISTS idx_videos_collection_birthtime 
            ON videos(collection_id, birthtimeMs DESC);

        CREATE INDEX IF NOT EXISTS idx_videos_category_id 
            ON videos(category_id);

        CREATE INDEX IF NOT EXISTS idx_images_collection_id 
            ON images(collection_id);

        CREATE INDEX IF NOT EXISTS idx_image_videos_video_id 
            ON image_videos(video_id);

        CREATE INDEX IF NOT EXISTS idx_tags_images_image_id 
            ON tags_images(image_id);

        CREATE INDEX IF NOT EXISTS idx_audios_collection_id 
            ON audios(collection_id);

        CREATE INDEX IF NOT EXISTS idx_audio_videos_video_id 
            ON audio_videos(video_id);

        CREATE INDEX IF NOT EXISTS idx_tags_audios_audio_id 
            ON tags_audios(audio_id);

        CREATE INDEX IF NOT EXISTS idx_image_location_clusters_cluster
            ON image_location_clusters(cluster_id);

        CREATE INDEX IF NOT EXISTS idx_image_location_clusters_image
            ON image_location_clusters(image_id);

        CREATE INDEX IF NOT EXISTS idx_video_location_clusters_cluster
            ON video_location_clusters(cluster_id);

        CREATE INDEX IF NOT EXISTS idx_video_location_clusters_video
            ON video_location_clusters(video_id);
        
        CREATE INDEX IF NOT EXISTS idx_videos_year 
            ON videos(year DESC, birthtimeMs DESC);
    `);
};

// This is required only for testing purposes
const resetDatabase = () => {
    if (db) {
        // erase all data from the tables in FK-safe order
        const tablesToReset = [
            'playlists_videos',
            'smart_playlist_videos',
            'related_videos',
            'video_metrics',
            'tags_videos',
            'image_videos',
            'tags_images',
            'audio_videos',
            'tags_audios',
            'watch_folder_media',
            'videos_fts',
            'images_fts',
            'audios_fts',
            'video_metadata',
            'search_history',
            'videos',
            'images',
            'audios',
            'playlists',
            'video_categories',
            'watch_folders',
            'vocabulary',
            'tags',
            'collections',
        ];

        try {
            tablesToReset.forEach((tableName) => {
                db.exec(`DELETE FROM ${tableName}`);
            });

            return true;
        } catch (err) {
            throw new Error(`Error resetting database: ${err.message}`);
        }
    }
};

const resetAllVideoMetaData = () => {
    if (db) {
        try {
            // reset all playlists
            db.exec('DELETE FROM playlists_videos');
            db.exec('DELETE FROM playlists');
            db.exec('DELETE FROM smart_playlist_videos');

            // Clear all tag associations and tags
            db.exec('DELETE FROM tags_videos');
            db.exec('DELETE FROM tags');

            // Clear all video metadata like views, rating, quality
            db.exec('DELETE FROM video_metrics');

            // Clear search history
            db.exec('DELETE FROM search_history');

            // Clear title for all videos but keep ID, name, path, etc.
            db.exec("UPDATE videos SET title = ''");

            return true;
        } catch (err) {
            throw new Error(`Error resetting video metadata: ${err.message}`);
        }
    }
};

const resetAllImageMetaData = () => {
    if (db) {
        try {
            // Clear all image metadata like description, transcript
            db.exec('DELETE FROM images_fts');
            db.exec('UPDATE images SET description = ""');
            db.exec('UPDATE images SET title = ""');

            return true;
        } catch (err) {
            throw new Error(`Error resetting image metadata: ${err.message}`);
        }
    }
};

const resetAllAudioMetaData = () => {
    if (db) {
        try {
            // Clear all audio metadata like description
            db.exec('DELETE FROM audios_fts');
            db.exec('UPDATE audios SET description = ""');
            db.exec('UPDATE audios SET title = ""');

            return true;
        } catch (err) {
            throw new Error(`Error resetting audio metadata: ${err.message}`);
        }
    }
};

const backupDatabase = (backupPath) => {
    if (!db) {
        throw new Error('Database is not initialized');
    }
    if (!doesDirectoryExist(backupPath)) {
        throw new Error('Backup directory does not exist');
    }

    try {
        const dateStamp =
            new Date().getDate().toString() + '_' + new Date().getHours().toString() + '_' + new Date().getMinutes().toString();

        const sourceDbPath = getDbPath(dbFileNames.VIDEO_LIBRARY);
        const backupDbPath = path.join(backupPath, `video_library_backup_${dateStamp}.db`);
        fs.copyFileSync(sourceDbPath, backupDbPath);
        return true;
    } catch (err) {
        throw new Error(`Error backing up database: ${err.message}`);
    }
};

const importDatabase = (backupPath) => {
    try {
        // close existing database,
        closeDatabase();
        const targetPath = getDbPath(dbFileNames.VIDEO_LIBRARY);

        fs.copyFileSync(backupPath, targetPath);
        initializeDatabase();

        return respondSuccess('Database imported successfully');
    } catch (err) {
        return respondError(`Error importing database: ${err.message}`);
    }
};

// Get current database connection
const getDb = () => {
    return db || null;
};

// Close database connection
const closeDatabase = () => {
    if (db) {
        try {
            db.close();
            db = null;
        } catch (err) {
            throw new Error(`Error closing database: ${err.message}`);
        }
    }
};

module.exports = {
    initializeDatabase,
    getDb,
    closeDatabase,
    backupDatabase,
    resetDatabase,
    resetAllVideoMetaData,
    resetAllImageMetaData,
    resetAllAudioMetaData,
    importDatabase,
};
