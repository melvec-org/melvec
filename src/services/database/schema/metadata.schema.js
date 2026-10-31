const createTables = (db) => {
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
};

const createIndexes = (db) => {};

module.exports = {
    createTables,
    createIndexes,
};
