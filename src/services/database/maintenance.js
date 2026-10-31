/**
 * Database maintenance utilities.
 *
 * These functions are intended for testing/development and
 * resetting generated metadata while preserving the media library.
 */

/**
 * Reset the entire database.
 *
 * Deletes all data from all application tables while preserving
 * the database schema.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {boolean}
 */
const resetDatabase = (db) => {
    if (!db) {
        throw new Error('Database is not initialized');
    }

    // Delete in FK-safe order.
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
        db.transaction(() => {
            tablesToReset.forEach((tableName) => {
                db.exec(`DELETE FROM ${tableName}`);
            });
        })();

        return true;
    } catch (err) {
        throw new Error(`Error resetting database: ${err.message}`);
    }
};

/**
 * Reset all video metadata while keeping the video records.
 *
 * Removes:
 * - playlists
 * - smart playlists
 * - tags
 * - video metrics
 * - search history
 *
 * Also clears generated video titles.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {boolean}
 */
const resetAllVideoMetaData = (db) => {
    if (!db) {
        throw new Error('Database is not initialized');
    }

    try {
        db.transaction(() => {
            // Reset playlists
            db.exec('DELETE FROM playlists_videos');
            db.exec('DELETE FROM playlists');
            db.exec('DELETE FROM smart_playlist_videos');

            // Clear tag associations and tags
            db.exec('DELETE FROM tags_videos');
            db.exec('DELETE FROM tags');

            // Clear video metrics
            db.exec('DELETE FROM video_metrics');

            // Clear search history
            db.exec('DELETE FROM search_history');

            // Clear generated video titles
            db.exec("UPDATE videos SET title = ''");
        })();

        return true;
    } catch (err) {
        throw new Error(`Error resetting video metadata: ${err.message}`);
    }
};

/**
 * Reset all image metadata.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {boolean}
 */
const resetAllImageMetaData = (db) => {
    if (!db) {
        throw new Error('Database is not initialized');
    }

    try {
        db.transaction(() => {
            db.exec('DELETE FROM images_fts');
            db.exec('UPDATE images SET description = ""');
            db.exec('UPDATE images SET title = ""');
        })();

        return true;
    } catch (err) {
        throw new Error(`Error resetting image metadata: ${err.message}`);
    }
};

/**
 * Reset all audio metadata.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {boolean}
 */
const resetAllAudioMetaData = (db) => {
    if (!db) {
        throw new Error('Database is not initialized');
    }

    try {
        db.transaction(() => {
            db.exec('DELETE FROM audios_fts');
            db.exec('UPDATE audios SET description = ""');
            db.exec('UPDATE audios SET title = ""');
        })();

        return true;
    } catch (err) {
        throw new Error(`Error resetting audio metadata: ${err.message}`);
    }
};

const backupDatabase = (db, backupPath) => {
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

const importDatabase = (closeDatabase, initializeDatabase, backupPath) => {
    try {
        closeDatabase();
        const targetPath = getDbPath(dbFileNames.VIDEO_LIBRARY);

        fs.copyFileSync(backupPath, targetPath);
        initializeDatabase();

        return respondSuccess('Database imported successfully');
    } catch (err) {
        return respondError(`Error importing database: ${err.message}`);
    }
};

module.exports = {
    resetDatabase,
    resetAllVideoMetaData,
    resetAllImageMetaData,
    resetAllAudioMetaData,
    backupDatabase,
    importDatabase,
};
