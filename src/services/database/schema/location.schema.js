const createTables = (db) => {
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
};
const createIndexes = (db) => {};

module.exports = {
    createTables,
    createIndexes,
};
