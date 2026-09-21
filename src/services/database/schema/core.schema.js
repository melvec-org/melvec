// core contains 1. collections, 2. videos 3. Images, 4. Audios

const createTables = (db) => {
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
                face_extraction_status TEXT DEFAULT NULL,
                has_preview INTEGER NOT NULL DEFAULT 0 CHECK (has_preview IN (0, 1))
                
            )
        `;
        db.exec(createVideosTable);
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
                face_extraction_status TEXT DEFAULT NULL,
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
const createIndexes = (db) => {};

module.exports = {
    createTables,
    createIndexes,
};
