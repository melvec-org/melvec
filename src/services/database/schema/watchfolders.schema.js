const createTables = (db) => {
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
};
const createIndexes = (db) => {};

module.exports = {
    createTables,
    createIndexes,
};
