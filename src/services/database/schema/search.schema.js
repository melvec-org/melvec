const createTables = (db) => {
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

    const vocabularyTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vocabulary'").get();
    if (!vocabularyTableExists) {
        db.exec(`
            CREATE TABLE vocabulary (
                term TEXT PRIMARY KEY
                
            )
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
};
const createIndexes = (db) => {};

module.exports = {
    createTables,
    createIndexes,
};
