const { getDb } = require('./database');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { VIDEO_CATEGORIES } = require('../../configs/categories');

let db = null;

const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDb first.');
    }
};

const initializeDb = () => {
    db = getDb();

    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
    });
};

const seedDefaultCategories = () => {
    ensureDbInitialized();

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO video_categories (id, label, description)
        VALUES (?, ?, ?)
    `);

    db.transaction(() => {
        VIDEO_CATEGORIES.forEach((category) => {
            stmt.run(category.id, category.label, category.description);
        });
    })();
};

const getAllCategories = () => {
    ensureDbInitialized();

    const stmt = db.prepare(`
        SELECT id, label, description
        FROM video_categories
    `);

    return stmt.all();
};

module.exports = {
    initializeDb,
    seedDefaultCategories,
    getAllCategories,
};
