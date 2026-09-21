const Database = require('better-sqlite3');
const { getDbPath, dbFileNames } = require('../servicePathConfig');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const {
    resetDatabase,
    resetAllVideoMetaData,
    resetAllImageMetaData,
    resetAllAudioMetaData,
    backupDatabase,
    importDatabase,
} = require('./maintenance');
const { createIndexes } = require('./indexes');

// schemas
const coreSchema = require('./schema/core.schema');
const locationSchema = require('./schema/location.schema');
const organizationSchema = require('./schema/organizations.schema');
const watchFoldersSchema = require('./schema/watchfolders.schema');
const searchSchema = require('./schema/search.schema');
const metaDataSchema = require('./schema/metadata.schema');
const subjectsSchema = require('./schema/subjects.schema');

let videoLibraryDbPath = '';
let db = null;

const createTables = () => {
    coreSchema.createTables(db);
    organizationSchema.createTables(db);
    watchFoldersSchema.createTables(db);
    locationSchema.createTables(db);
    metaDataSchema.createTables(db);
    searchSchema.createTables(db);
    subjectsSchema.createTables(db);
};

const initializeDatabase = (dbFileName = dbFileNames.VIDEO_LIBRARY) => {
    videoLibraryDbPath = getDbPath(dbFileName);

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
    createIndexes(db);

    serviceEventBus.publish(interServiceEvents.DATABASE_INITIALIZED, {
        db: db,
    });

    serviceEventBus.subscribe(interServiceEvents.BEFORE_APP_QUIT, () => {
        closeDatabase();
    });

    return db;
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
    backupDatabase: (backupPath) => backupDatabase(db, backupPath),
    resetDatabase: () => resetDatabase(db),
    resetAllVideoMetaData: () => resetAllVideoMetaData(db),
    resetAllImageMetaData: () => resetAllImageMetaData(db),
    resetAllAudioMetaData: () => resetAllAudioMetaData(db),
    importDatabase: (backupPath) => importDatabase(closeDatabase, initializeDatabase, backupPath),
};
