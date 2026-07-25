const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { getDb } = require('./database');

let db;
const MAX_SEARCH_RECORDS = 2000;

const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return db;
};
const initializeSearchHistoryDbService = () => {
    db = getDb();

    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
    });
};

const validateSearchLabel = (label) => {
    if (!label || typeof label !== 'string' || label.trim() === '') {
        throw new Error('Search label must be a non-empty string');
    }
};

// Maintains max 2000 records by deleting oldest if necessary
const enforceRecordLimit = () => {
    const countStmt = db.prepare('SELECT COUNT(*) AS count FROM search_history');
    const { count } = countStmt.get();

    if (count >= MAX_SEARCH_RECORDS) {
        const deleteStmt = db.prepare(`
            DELETE FROM search_history
            WHERE id = (
                SELECT id FROM search_history
                ORDER BY last_searched_at ASC
                LIMIT 1
            )
        `);
        deleteStmt.run();
    }
};

const addToSearchHistory = (label) => {
    ensureDbInitialized();
    validateSearchLabel(label);

    const last_searched_at = Date.now();
    try {
        return db.transaction(() => {
            // Check if label already exists
            const selectStmt = db.prepare(`
                SELECT id, occurrence FROM search_history WHERE label = ?
            `);
            const existing = selectStmt.get(label);

            if (existing) {
                // Update existing record
                const updateStmt = db.prepare(`
                    UPDATE search_history
                    SET occurrence = ?, last_searched_at = ?
                    WHERE id = ?
                `);
                const newOccurrence = existing.occurrence + 1;
                const result = updateStmt.run(newOccurrence, last_searched_at, existing.id);
                return result.changes > 0 ? { id: existing.id, label, occurrence: newOccurrence, last_searched_at } : null;
            } else {
                // Enforce record limit before inserting
                enforceRecordLimit();
                // Insert new record
                const insertStmt = db.prepare(`
                    INSERT INTO search_history (label, occurrence, last_searched_at)
                    VALUES (?, ?, ?)
                `);
                const result = insertStmt.run(label, 1, last_searched_at);
                const selectIdStmt = db.prepare('SELECT last_insert_rowid() AS id');
                const { id } = selectIdStmt.get();
                return result.changes > 0 ? { id, label, occurrence: 1, last_searched_at } : null;
            }
        })();
    } catch (err) {
        throw new Error(`Failed to add or update search history entry: ${err.message}`);
    }
};

// Get search history with optional limit parameter
const getSearchHistory = (limit = 5) => {
    ensureDbInitialized();
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error('Limit must be a positive integer');
    }
    try {
        const stmt = db.prepare(`
            SELECT id, label, occurrence, last_searched_at
            FROM search_history
            ORDER BY last_searched_at DESC
            LIMIT ?
        `);
        const searchHistoryList = stmt.all(Math.min(limit, MAX_SEARCH_RECORDS));

        return searchHistoryList;
    } catch (err) {
        throw new Error(`Failed to fetch search history: ${err.message}`);
    }
};

const clearSearchHistory = () => {
    ensureDbInitialized();
    try {
        const stmt = db.prepare('DELETE FROM search_history');
        const result = db.transaction(() => {
            return stmt.run();
        })();
        const deletedCount = result.changes;
        return {
            success: true,
            deletedCount,
            message: `Deleted ${deletedCount} search history entries`,
        };
    } catch (err) {
        console.error('Error deleting all search history:', err);
        throw new Error(`Failed to delete all search history: ${err.message}`);
    }
};

// Delete a single search history entry by label
const deleteSearchHistoryByLabel = (label) => {
    ensureDbInitialized();
    validateSearchLabel(label);

    try {
        const stmt = db.prepare('DELETE FROM search_history WHERE label = ?');
        const result = db.transaction(() => {
            return stmt.run(label);
        })();
        return {
            success: result.changes > 0,
            deletedCount: result.changes,
            message: result.changes > 0 ? `Deleted search history entry with label "${label}"` : `No search history entry found with label "${label}"`,
        };
    } catch (err) {
        console.error(`Error deleting search history entry with label "${label}":`, err);
        throw new Error(`Failed to delete search history entry: ${err.message}`);
    }
};

const getSearchHistoryByOccurenceAndTime = (limit = 5) => {
    ensureDbInitialized();

    // Validate parameter
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error('Limit must be a positive integer');
    }

    try {
        const stmt = db.prepare(`
            SELECT id, label, occurrence, last_searched_at
            FROM search_history
            ORDER BY occurrence DESC, last_searched_at DESC
            LIMIT ?
        `);
        return stmt.all(Math.min(limit, MAX_SEARCH_RECORDS));
    } catch (err) {
        throw new Error(`Failed to fetch search history by occurrence and time: ${err.message}`);
    }
};

module.exports = {
    initializeSearchHistoryDbService,
    addToSearchHistory,
    getSearchHistory,
    clearSearchHistory,
    deleteSearchHistoryByLabel,
    getSearchHistoryByOccurenceAndTime,
};
