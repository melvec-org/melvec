const { getDb } = require('../database/database');
const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { buildNearQuery, cleanSearchTerms } = require('../service-utils/cleanSearchQuery');
const { getRelativeMediaPath } = require('../service-utils/mediaPath');
const { getYearFromTime } = require('../service-utils/timeUtils');

const CACHE_SIZE = 2000;
const audioDbCache = new LRUCache(CACHE_SIZE);

const EMBEDDING_CACHE_SIZE = 100;
const audioEmbeddingCache = new LRUCache(EMBEDDING_CACHE_SIZE);

const DESCRIPTION_CACHE_SIZE = 200;
const descriptionCache = new LRUCache(DESCRIPTION_CACHE_SIZE);

let db = null;

const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
};

const getAudioDetailsById = (id, skipCache = false) => {
    ensureDbInitialized();

    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }

    const normalizedId = id.trim();
    const cachedDetails = audioDbCache.get(normalizedId);
    if (cachedDetails && skipCache === false) {
        return cachedDetails;
    }

    try {
        const stmt = db.prepare(`
            SELECT
                a.id,
                a.name,
                a.title,
                a.role,
                c.label AS coll,
                a.collection_id,
                a.birthtimeMs,
                a.size,
                a.duration,
                a.source,
                a.is_nsfw
            FROM audios a
            LEFT JOIN collections c ON c.id = a.collection_id
            WHERE a.id = ?
            LIMIT 1
        `);

        const audioDetails = stmt.get(normalizedId) || null;

        if (audioDetails) {
            audioDetails.path = getRelativeMediaPath(
                getYearFromTime(audioDetails.birthtimeMs),
                audioDetails.coll,
                audioDetails.name,
                audioDetails.id,
            );
            audioDbCache.set(normalizedId, audioDetails);
        }

        return audioDetails;
    } catch (err) {
        throw new Error(`Failed to get audio ${normalizedId}: ${err.message}`);
    }
};

const getAudioDescriptionById = (id, skipCache = false) => {
    ensureDbInitialized();

    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }

    const normalizedId = id.trim();
    const cachedDescription = descriptionCache.get(normalizedId);
    if (cachedDescription && skipCache === false) {
        return cachedDescription;
    }

    try {
        const stmt = db.prepare(`
            SELECT description
            FROM audios
            WHERE id = ?
            LIMIT 1
        `);

        const result = stmt.get(normalizedId) || null;

        if (result) {
            descriptionCache.set(normalizedId, result.description);
        }

        return result?.description;
    } catch (err) {
        throw new Error(`Failed to get audio ${normalizedId}: ${err.message}`);
    }
};

const checkForDuplicateAudio = (audioId) => {
    ensureDbInitialized();

    if (!audioId || typeof audioId !== 'string' || audioId.trim() === '') {
        throw new Error('Field audioId must be a non-empty string');
    }

    const normalizedAudioId = audioId.trim();
    const cached = audioDbCache.get(normalizedAudioId);

    if (cached) {
        return true;
    }

    try {
        const stmt = db.prepare(`
            SELECT 1
            FROM audios
            WHERE id = ?
            LIMIT 1
        `);

        const result = stmt.get(normalizedAudioId);
        return !!result;
    } catch (err) {
        throw new Error(`Failed to check duplicate audio ${normalizedAudioId}: ${err.message}`);
    }
};

const addAudio = (audio) => {
    ensureDbInitialized();
    const {
        id,
        name,
        title = '',
        role = 'audio',
        collection_id,
        birthtimeMs,
        size,
        duration = null,
        description = '',
        source = 'local',
        is_nsfw = 0,
    } = audio;

    const requiredFields = { id, name, role, collection_id, birthtimeMs, size, description, source, is_nsfw };
    for (const [key, value] of Object.entries(requiredFields)) {
        if (value === null || value === undefined) {
            throw new Error(`Field ${key} cannot be null or undefined`);
        }
    }

    const textFields = { id, name, role, collection_id, source };
    for (const [key, value] of Object.entries(textFields)) {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(`Field ${key} must be a non-empty string`);
        }
    }

    if (typeof title !== 'string') {
        throw new Error('Field title must be a string');
    }

    if (typeof description !== 'string') {
        throw new Error('Field description must be a string');
    }

    const normalisedDescription = description.replace(/\\\"/g, '"');

    const integerFields = { birthtimeMs, size, is_nsfw };
    for (const [key, value] of Object.entries(integerFields)) {
        if (!Number.isInteger(value)) {
            throw new Error(`Field ${key} must be an integer`);
        }
    }

    if (birthtimeMs < 0) {
        throw new Error('birthtimeMs must be non-negative');
    }

    if (size < 0) {
        throw new Error('Size must be non-negative');
    }

    if (duration !== null && typeof duration !== 'number') {
        throw new Error('Field duration must be a number or null');
    }

    if (![0, 1].includes(is_nsfw)) {
        throw new Error('Field is_nsfw must be either 0 or 1');
    }

    if (checkForDuplicateAudio(id)) {
        throw new Error(`Duplicate ID: ${id} already exists`);
    }

    const stmt = db.prepare(`
        INSERT INTO audios (
            id,
            name,
            title,
            role,
            collection_id,
            birthtimeMs,
            size,
            duration,
            description,
            source,
            is_nsfw
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
        db.transaction(() => {
            stmt.run(id, name, title, role, collection_id, birthtimeMs, size, duration, normalisedDescription, source, is_nsfw);
        })();

        const audioDetails = getAudioDetailsById(id);
        if (audioDetails) {
            audioDbCache.set(id, audioDetails);
        }

        return id;
    } catch (err) {
        throw new Error(`Failed to add audio ${id}: ${err.message}`);
    }
};

const updateAudioDetails = (audio) => {
    ensureDbInitialized();

    const { id, name, title, role, collection_id, birthtimeMs, size, duration, source, is_nsfw } = audio;

    const requiredFields = {
        id,
        name,
        title,
        role,
        collection_id,
        birthtimeMs,
        size,
        source,
        is_nsfw,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
        if (value === null || value === undefined) {
            throw new Error(`Field ${key} cannot be null or undefined`);
        }
    }

    const textFields = { id, name, title, role, collection_id, source };
    for (const [key, value] of Object.entries(textFields)) {
        if (typeof value !== 'string') {
            throw new Error(`Field ${key} must be a string`);
        }
    }

    const nonEmptyTextFields = { id, name, role, collection_id, source };
    for (const [key, value] of Object.entries(nonEmptyTextFields)) {
        if (value.trim() === '') {
            throw new Error(`Field ${key} must be a non-empty string`);
        }
    }

    const integerFields = { birthtimeMs, size, is_nsfw };
    for (const [key, value] of Object.entries(integerFields)) {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`Field ${key} must be a non-negative integer`);
        }
    }

    if (duration !== null && typeof duration !== 'number') {
        throw new Error('Field duration must be a number or null');
    }

    if (![0, 1].includes(is_nsfw)) {
        throw new Error('Field is_nsfw must be either 0 or 1');
    }

    const stmt = db.prepare(`
        UPDATE audios
        SET
            name = ?,
            title = ?,
            role = ?,
            collection_id = ?,
            birthtimeMs = ?,
            size = ?,
            duration = ?,
            source = ?,
            is_nsfw = ?
        WHERE
            id = ?
    `);

    try {
        const info = db.transaction(() => {
            const result = stmt.run(name, title, role, collection_id, birthtimeMs, size, duration, source, is_nsfw, id);
            return result;
        })();

        if (info.changes > 0) {
            const updatedAudio = getAudioDetailsById(id, true);
            audioDbCache.set(id, updatedAudio);
            return updatedAudio;
        }
    } catch (err) {
        throw new Error(`Failed to update audio ${id}: ${err.message}`);
    }
};

const deleteAudioFromDb = async (id) => {
    ensureDbInitialized();
    const stmt = db.prepare('DELETE FROM audios WHERE id = ?');

    try {
        const info = db.transaction(() => {
            const result = stmt.run(id);
            if (result.changes > 0) {
                audioDbCache.delete(id);
            }
            return result;
        })();
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to delete audio ${id}: ${err.message}`);
    }
};

const checkAudioExists = (audio_id) => {
    ensureDbInitialized();

    if (!audio_id || typeof audio_id !== 'string' || audio_id.trim() === '') {
        throw new Error('Field audio_id must be a non-empty string');
    }

    const normalizedAudioId = audio_id.trim();

    try {
        const stmt = db.prepare(`
            SELECT 1
            FROM audios
            WHERE id = ?
            LIMIT 1
        `);

        const result = stmt.get(normalizedAudioId);
        return !!result;
    } catch (err) {
        throw new Error(`Failed to check if audio exists ${normalizedAudioId}: ${err.message}`);
    }
};

const updateAudioSource = (id, source) => {
    ensureDbInitialized();

    if (id === null || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }
    if (!source || typeof source !== 'string' || source.trim() === '') {
        throw new Error('Field source must be a non-empty string');
    }

    const existing = getAudioDetailsById(id, true);
    if (!existing) {
        throw new Error(`Audio not found: ${id}`);
    }

    const updated = updateAudioDetails({ ...existing, source });
    return !!updated;
};

const getAudiosByFileNameSearch = (keyword) => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT id, name
            FROM audios
            WHERE name IS NOT NULL AND LOWER(name) LIKE ?
        `);

        const audios = stmt.all(`%${keyword.toLowerCase()}%`);

        return audios.map((audio) => ({
            id: audio.id,
            name: audio.name,
        }));
    } catch (err) {
        throw new Error(`Error searching audios by file name: ${err.message}`);
    }
};

const getAudiosByTitleDbSearch = (keyword) => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT id, title
            FROM audios
            WHERE title IS NOT NULL AND LOWER(title) LIKE?
        `);

        const audios = stmt.all(`%${keyword.toLowerCase()}%`);

        return audios.map((audio) => ({
            id: audio.id,
            title: audio.title,
        }));
    } catch (err) {
        throw new Error(`Error searching audios by title: ${err.message}`);
    }
};

const updateAudioDescription = (id, description) => {
    ensureDbInitialized();
    if (id === null || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }
    if (!description || typeof description !== 'string') {
        throw new Error('Field description must be a string');
    }

    const existing = getAudioDetailsById(id, true);
    if (!existing) {
        throw new Error(`Audio not found: ${id}`);
    }

    try {
        const stmt = db.prepare(`
            UPDATE audios
            SET description =?
            WHERE id =?
        `);

        const result = stmt.run(description, id);
        if (result.changes > 0) {
            const updatedDescription = getAudioDescriptionById(id, true);
            descriptionCache.set(id, updatedDescription);
            return updatedDescription;
        }
    } catch (err) {
        throw new Error(`Failed to update audio description: ${err.message}`);
    }
};

const updateDescriptionAndEmbedding = (id, description = '', embedding = '') => {
    ensureDbInitialized();
    if (id === null || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }
    if (!description || typeof description !== 'string') {
        throw new Error('Field description must be a string');
    }

    const embeddingStr = Array.isArray(embedding) ? JSON.stringify(embedding) : '';

    const existing = getAudioDetailsById(id, true);
    if (!existing) {
        throw new Error(`Audio not found: ${id}`);
    }

    try {
        const stmt = db.prepare(`
            UPDATE audios
            SET description =?, embedding =?
            WHERE id =?
        `);

        const result = stmt.run(description, embeddingStr, id);
        if (result.changes > 0) {
            const updatedAudio = getAudioDetailsById(id, true);
            audioDbCache.set(id, updatedAudio);
            return updatedAudio;
        }
    } catch (err) {
        throw new Error(`Failed to update audio description and embedding: ${err.message}`);
    }
};

const getEmbeddingByAudioId = (audioId) => {
    ensureDbInitialized();

    const cachedEmbedding = audioEmbeddingCache.get(audioId);
    if (typeof cachedEmbedding !== 'undefined') {
        return cachedEmbedding;
    }

    try {
        const stmt = db.prepare(`
            SELECT embedding
            FROM audios
            WHERE id = ?
            LIMIT 1
        `);

        const row = stmt.get(audioId);
        const embedding = row?.embedding ? JSON.parse(row.embedding) : [];

        audioEmbeddingCache.set(audioId, embedding);

        return embedding;
    } catch (error) {
        throw new Error(`Failed to get embedding for audio ${audioId}: ${error.message}`);
    }
};

const searchAudiosByDescription = (searchText) => {
    ensureDbInitialized();

    const cleanedTerms = cleanSearchTerms(searchText || '');
    if (!cleanedTerms) return [];

    const escapeToken = (token) => String(token).replace(/"/g, '""');

    const exactQuery = cleanedTerms.map((t) => `"${escapeToken(t)}"`).join(' AND ');

    let finalQuery = `(${exactQuery})`;

    if (cleanedTerms.length === 1) {
        const singleTerm = escapeToken(cleanedTerms[0]);

        if (singleTerm.length >= 4) {
            const prefixQuery = `${singleTerm}*`;
            finalQuery = `(${exactQuery}) OR (${prefixQuery})`;
        }
    } else {
        const nearQuery = buildNearQuery(cleanedTerms);

        if (nearQuery) {
            finalQuery = `(${exactQuery}) OR (${nearQuery})`;
        }
    }

    try {
        const stmt = db.prepare(`
            SELECT
                a.id,
                bm25(audios_fts) AS score,
                snippet(audios_fts, 2, '<b>', '</b>', ' … ', 80) AS desc_match
            FROM audios_fts
            JOIN audios a ON a.id = audios_fts.audio_id
            WHERE audios_fts MATCH ?
            ORDER BY score ASC
            LIMIT 5 OFFSET ?
        `);

        return stmt.all(finalQuery, 0);
    } catch (error) {
        throw new Error(`Failed to search audio descriptions: ${error.message}`);
    }
};

const searchAudiosLooseByDescription = (searchText, limit = 50, offset = 0) => {
    ensureDbInitialized();

    const cleanedTerms = cleanSearchTerms(searchText || '');
    if (!cleanedTerms) return [];

    const escapeToken = (token) => String(token).replace(/"/g, '""');

    const exactOrQuery = cleanedTerms.map((t) => `"${escapeToken(t)}"`).join(' OR ');

    let finalQuery = `(${exactOrQuery})`;

    if (cleanedTerms.length === 1) {
        const singleTerm = escapeToken(cleanedTerms[0]);

        if (singleTerm.length >= 4) {
            const prefixQuery = `${singleTerm}*`;
            finalQuery = `(${exactOrQuery}) OR (${prefixQuery})`;
        }
    } else {
        const nearQuery = buildNearQuery(cleanedTerms);

        if (nearQuery) {
            finalQuery = `(${nearQuery}) OR (${exactOrQuery})`;
        }
    }

    try {
        const stmt = db.prepare(`
            SELECT
                a.id,
                bm25(audios_fts) AS score,
                snippet(audios_fts, 2, '<b>', '</b>', ' … ', 80) AS desc_match
            FROM audios_fts
            JOIN audios a ON a.id = audios_fts.audio_id
            WHERE audios_fts MATCH ?
            ORDER BY score ASC
            LIMIT ? OFFSET ?
        `);

        return stmt.all(finalQuery, limit, offset);
    } catch (error) {
        throw new Error(`Failed to search audio descriptions loosely: ${error.message}`);
    }
};

const getAllAudioIds = () => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`SELECT id FROM audios`);
        return stmt.all().map((row) => row.id);
    } catch (err) {
        throw new Error(`Failed to get all audio ids: ${err.message}`);
    }
};

const getAudioListWithoutDescription = () => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT id
            FROM audios
            WHERE description IS NULL OR description = ''
        `);

        const audios = stmt.all();

        return audios.map((audio) => audio.id);
    } catch (err) {
        throw new Error(`Error getting audios without description: ${err.message}`);
    }
};

const getAudioTitlesAndDescriptionsByIds = (ids = []) => {
    ensureDbInitialized();

    if (!ids.length) return [];

    try {
        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT id, title, description
            FROM audios
            WHERE id IN (${placeholders})
        `);

        return stmt.all(...ids);
    } catch (err) {
        throw new Error(`Failed to fetch audio titles and descriptions: ${err.message}`);
    }
};

const resetAudiosMetaData = (ids, metaDataList) => {
    ensureDbInitialized();

    if (!ids.length || !metaDataList.length) return;

    const metaList = metaDataList.map((meta) => {
        if (!meta.id || typeof meta.id !== 'string' || meta.id.trim() === '') {
            throw new Error('Field id must be a non-empty string');
        }
        return [meta.title, meta.description, meta.id];
    });

    try {
        const stmt = db.prepare(`
            UPDATE audios
            SET title =?, description =?
            WHERE id =?
        `);

        const transaction = db.transaction((items) => {
            items.forEach(([title, description, id]) => {
                stmt.run(title, description, id);
            });
        });

        transaction(metaList);

        ids.forEach((id) => {
            audioDbCache.delete(id);
            descriptionCache.delete(id);
            audioEmbeddingCache.delete(id);
        });
        return true;
    } catch (err) {
        throw new Error(`Failed to reset audio metadata: ${err.message}`);
    }
};

const clearAudiosCache = () => {
    audioDbCache.clear();
    audioEmbeddingCache.clear();
    descriptionCache.clear();
};

const initializeDb = () => {
    db = getDb();
    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        audioDbCache.clear();
        audioEmbeddingCache.clear();
        descriptionCache.clear();
    });
    serviceEventBus.subscribe(interServiceEvents.INDEX_DATA_CHANGED, () => {
        audioDbCache.clear();
        audioEmbeddingCache.clear();
        descriptionCache.clear();
    });
    audioDbCache.clear();
    audioEmbeddingCache.clear();
    descriptionCache.clear();
};

module.exports = {
    getAudioDetailsById,
    getAudioDescriptionById,
    getAllAudioIds,
    checkForDuplicateAudio,
    addAudio,
    updateAudioDetails,
    deleteAudioFromDb,
    checkAudioExists,
    updateAudioSource,
    updateAudioDescription,
    clearAudiosCache,
    getAudiosByFileNameSearch,
    getAudiosByTitleDbSearch,
    initializeDb,
    updateDescriptionAndEmbedding,
    getAudioListWithoutDescription,
    getEmbeddingByAudioId,
    searchAudiosByDescription,
    searchAudiosLooseByDescription,
    getAudioTitlesAndDescriptionsByIds,
    resetAudiosMetaData,
};
