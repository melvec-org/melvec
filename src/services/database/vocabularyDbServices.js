const { getDb } = require('./database');

const ensureDbInitialized = () => {
    const db = getDb();

    if (!db) {
        throw new Error('Database is not initialized');
    }

    return db;
};

const normalizeTerm = (term) => {
    if (typeof term !== 'string') {
        return '';
    }

    return term.trim().toLowerCase();
};

const getVocabulary = () => {
    const db = ensureDbInitialized();

    const stmt = db.prepare(`
        SELECT term
        FROM vocabulary
        ORDER BY term ASC
    `);

    const rows = stmt.all();

    return rows.map((row) => row.term);
};

const saveVocabulary = (terms = []) => {
    const db = ensureDbInitialized();

    const normalizedTerms = [...new Set(terms.map(normalizeTerm).filter(Boolean))];

    const deleteStmt = db.prepare(`
        DELETE FROM vocabulary
    `);

    const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO vocabulary (term)
        VALUES (?)
    `);

    const saveTransaction = db.transaction((items) => {
        deleteStmt.run();

        for (const term of items) {
            insertStmt.run(term);
        }
    });

    saveTransaction(normalizedTerms);

    return normalizedTerms;
};

const addVocabularyTerms = (terms = []) => {
    const db = ensureDbInitialized();

    const normalizedTerms = [...new Set(terms.map(normalizeTerm).filter(Boolean))];

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO vocabulary (term)
        VALUES (?)
    `);

    db.transaction(() => {
        normalizedTerms.forEach((term) => {
            insertStmt.run(term);
        });
    })();

    return normalizedTerms;
};

const clearVocabulary = () => {
    const db = ensureDbInitialized();

    const stmt = db.prepare(`
        DELETE FROM vocabulary
    `);

    stmt.run();

    return true;
};

module.exports = {
    getVocabulary,
    saveVocabulary,
    addVocabularyTerms,
    clearVocabulary,
};
