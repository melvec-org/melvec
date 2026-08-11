const { getDb } = require('../database/database');
const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { buildNearQuery, cleanSearchTerms } = require('../service-utils/cleanSearchQuery');

const CACHE_SIZE = 2000;
const imageDbCache = new LRUCache(CACHE_SIZE);

const EMBEDDING_CACHE_SIZE = 100;
const imageEmbeddingCache = new LRUCache(EMBEDDING_CACHE_SIZE);

const DESCRIPTION_CACHE_SIZE = 200;
const descriptionCache = new LRUCache(DESCRIPTION_CACHE_SIZE);

let db = null;

// Ensure db is initialized
const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
};

// this should not return description as the response size would be heavy to deal with.
const getImageDetailsById = (id, skipCache = false) => {
    ensureDbInitialized();

    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }

    const normalizedId = id.trim();
    const cachedDetails = imageDbCache.get(normalizedId);
    if (cachedDetails && skipCache === false) {
        return cachedDetails;
    }

    try {
        const stmt = db.prepare(`
            SELECT
                i.id,
                i.name,
                i.title,
                i.role,
                i.path,
                c.label AS coll,
                i.collection_id,
                i.birthtimeMs,
                i.size,
                i.source,
                i.is_nsfw,
                i.latitude,
                i.longitude
            FROM images i
            LEFT JOIN collections c ON c.id = i.collection_id
            WHERE i.id = ?
            LIMIT 1
        `);

        const imageDetails = stmt.get(normalizedId) || null;

        if (imageDetails) {
            imageDbCache.set(normalizedId, imageDetails);
        }

        return imageDetails;
    } catch (err) {
        throw new Error(`Failed to get image ${normalizedId}: ${err.message}`);
    }
};
const getImageDescriptionById = (id, skipCache = false) => {
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
            FROM images 
            WHERE id = ?
            LIMIT 1
        `);

        const result = stmt.get(normalizedId) || null;

        if (result) {
            descriptionCache.set(normalizedId, result.description);
        }

        return result.description;
    } catch (err) {
        throw new Error(`Failed to get image ${normalizedId}: ${err.message}`);
    }
};

const checkForDuplicateImage = (imageId) => {
    ensureDbInitialized();

    if (!imageId || typeof imageId !== 'string' || imageId.trim() === '') {
        throw new Error('Field imageId must be a non-empty string');
    }

    const normalizedImageId = imageId.trim();
    const cached = imageDbCache.get(normalizedImageId);

    if (cached) {
        return true;
    }

    try {
        const stmt = db.prepare(`
            SELECT 1
            FROM images
            WHERE id = ?
            LIMIT 1
        `);

        const result = stmt.get(normalizedImageId);
        return !!result;
    } catch (err) {
        throw new Error(`Failed to check duplicate image ${normalizedImageId}: ${err.message}`);
    }
};

const addImage = (image) => {
    ensureDbInitialized();

    const {
        id,
        name,
        title = '',
        role = 'image',
        path,
        collection_id,
        birthtimeMs,
        size,
        description = '',
        source = 'local',
        is_nsfw = 0,
        latitude = 0,
        longitude = 0,
    } = image;

    const requiredFields = { id, name, role, path, collection_id, birthtimeMs, size, description, source, is_nsfw };
    for (const [key, value] of Object.entries(requiredFields)) {
        if (value === null || value === undefined) {
            throw new Error(`Field ${key} cannot be null or undefined`);
        }
    }

    const textFields = { id, name, role, path, collection_id, source };
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

    // Normalize description: replace backslash-escaped quotes (e.g. \"text\") with
    // plain quotes so the FTS unicode61 tokenizer can correctly index words like
    // names that appear inside quoted strings in AI-generated descriptions.
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

    if (![0, 1].includes(is_nsfw)) {
        throw new Error('Field is_nsfw must be either 0 or 1');
    }

    if (checkForDuplicateImage(id)) {
        throw new Error(`Duplicate ID: ${id} already exists`);
    }

    const stmt = db.prepare(`
        INSERT INTO images (
            id,
            name,
            title,
            role,
            path,
            collection_id,
            birthtimeMs,
            size,
            description,
            source,
            is_nsfw,
            latitude,
            longitude
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
        db.transaction(() => {
            stmt.run(
                id,
                name,
                title,
                role,
                path,
                collection_id,
                birthtimeMs,
                size,
                normalisedDescription,
                source,
                is_nsfw,
                latitude,
                longitude,
            );
        })();

        const imageDetails = getImageDetailsById(id);
        if (imageDetails) {
            imageDbCache.set(id, imageDetails);
        }

        return id;
    } catch (err) {
        throw new Error(`Failed to add image ${id}: ${err.message}`);
    }
};

const updateImageDetails = (image) => {
    ensureDbInitialized();

    const { id, name, title, role, path, collection_id, birthtimeMs, size, source, is_nsfw } = image;

    const requiredFields = {
        id,
        name,
        title,
        role,
        path,
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

    const textFields = { id, name, title, role, path, collection_id, source };
    for (const [key, value] of Object.entries(textFields)) {
        if (typeof value !== 'string') {
            throw new Error(`Field ${key} must be a string`);
        }
    }

    const nonEmptyTextFields = { id, name, role, path, collection_id, source };
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

    if (![0, 1].includes(is_nsfw)) {
        throw new Error('Field is_nsfw must be either 0 or 1');
    }

    const stmt = db.prepare(`
        UPDATE images
        SET
            name = ?,
            title = ?,
            role = ?,
            path = ?,
            collection_id = ?,
            birthtimeMs = ?,
            size = ?,
            source = ?,
            is_nsfw = ?
        WHERE
            id = ?
    `);

    try {
        const info = db.transaction(() => {
            const result = stmt.run(name, title, role, path, collection_id, birthtimeMs, size, source, is_nsfw, id);
            return result;
        })();

        if (info.changes > 0) {
            const updatedImage = getImageDetailsById(id, true);
            imageDbCache.set(id, updatedImage);
            return updatedImage;
        }
    } catch (err) {
        throw new Error(`Failed to update image ${id}: ${err.message}`);
    }
};

const deleteImageFromDb = (id) => {
    ensureDbInitialized();
    const stmt = db.prepare('DELETE FROM images WHERE id = ?');

    try {
        const info = db.transaction(() => {
            const result = stmt.run(id);
            if (result.changes > 0) {
                imageDbCache.delete(id);
            }
            return result;
        })();
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to delete image ${id}: ${err.message}`);
    }
};

const checkImageExists = (image_id) => {
    ensureDbInitialized();

    if (!image_id || typeof image_id !== 'string' || image_id.trim() === '') {
        throw new Error('Field image_id must be a non-empty string');
    }

    const normalizedImageId = image_id.trim();

    try {
        const stmt = db.prepare(`
            SELECT 1
            FROM images
            WHERE id = ?
            LIMIT 1
        `);

        const result = stmt.get(normalizedImageId);
        return !!result;
    } catch (err) {
        throw new Error(`Failed to check if image exists ${normalizedImageId}: ${err.message}`);
    }
};

const updateImageSource = (id, source) => {
    ensureDbInitialized();

    if (id === null || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }
    if (!source || typeof source !== 'string' || source.trim() === '') {
        throw new Error('Field source must be a non-empty string');
    }

    const existing = getImageDetailsById(id, true);
    if (!existing) {
        throw new Error(`Image not found: ${id}`);
    }

    const updated = updateImageDetails({ ...existing, source });
    return !!updated;
};

const getImagesByFileNameSearch = (keyword) => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT id, name
            FROM images
            WHERE name IS NOT NULL AND LOWER(name) LIKE ?
        `);

        const images = stmt.all(`%${keyword.toLowerCase()}%`);

        return images.map((image) => ({
            id: image.id,
            name: image.name,
        }));
    } catch (err) {
        throw new Error(`Error searching images by file name: ${err.message}`);
    }
};

const getImagesByTitleDbSearch = (keyword) => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT id, title
            FROM images
            WHERE title IS NOT NULL AND LOWER(title) LIKE?
        `);

        const images = stmt.all(`%${keyword.toLowerCase()}%`);

        return images.map((image) => ({
            id: image.id,
            title: image.title,
        }));
    } catch (err) {
        throw new Error(`Error searching images by title: ${err.message}`);
    }
};

const updateImageDescription = (id, description) => {
    ensureDbInitialized();
    if (id === null || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Field id must be a non-empty string');
    }
    if (!description || typeof description !== 'string') {
        throw new Error('Field description must be a string');
    }

    const existing = getImageDetailsById(id, true);
    if (!existing) {
        throw new Error(`Image not found: ${id}`);
    }

    try {
        const stmt = db.prepare(`
            UPDATE images
            SET description =?
            WHERE id =?
        `);

        const result = stmt.run(description, id);
        if (result.changes > 0) {
            const updateDescription = getImageDescriptionById(id, true);
            descriptionCache.set(id, updateDescription);
            return updateDescription;
        }
    } catch (err) {
        throw new Error(`Failed to update image description: ${err.message}`);
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

    const existing = getImageDetailsById(id, true);
    if (!existing) {
        throw new Error(`Image not found: ${id}`);
    }

    try {
        const stmt = db.prepare(`
            UPDATE images
            SET description =?, embedding =?
            WHERE id =?
        `);

        const result = stmt.run(description, embeddingStr, id);
        if (result.changes > 0) {
            const updatedImage = getImageDetailsById(id, true);
            imageDbCache.set(id, updatedImage);
            return updatedImage;
        }
    } catch (err) {
        throw new Error(`Failed to update image description and embedding: ${err.message}`);
    }
};

/**
 * Returns the parsed embedding vector for a given image.
 *
 * Embeddings are cached independently because they are larger than most other
 * data and are often accessed by similarity-related features.
 *
 * @param {string} imageId - Unique image identifier.
 * @returns {Array<number>} Parsed embedding vector, or empty array if not set.
 */
const getEmbeddingByImageId = (imageId) => {
    ensureDbInitialized();

    const cachedEmbedding = imageEmbeddingCache.get(imageId);
    if (typeof cachedEmbedding !== 'undefined') {
        return cachedEmbedding;
    }

    try {
        const stmt = db.prepare(`
            SELECT embedding
            FROM images
            WHERE id = ?
            LIMIT 1
        `);

        const row = stmt.get(imageId);
        const embedding = row?.embedding ? JSON.parse(row.embedding) : [];

        imageEmbeddingCache.set(imageId, embedding);

        return embedding;
    } catch (error) {
        throw new Error(`Failed to get embedding for image ${imageId}: ${error.message}`);
    }
};

/**
 * Searches the images FTS index using a strict query strategy.
 *
 * For multi-word searches, all tokens must be present (AND). A NEAR query is
 * also attempted. For a single sufficiently long word, prefix matching is added.
 * Returns the top 5 matches ordered by relevance score.
 *
 * @param {string} searchText - User-entered search text.
 * @returns {Array<Object>} Matching image rows with ranking score and description snippet.
 */
const searchImagesByDescription = (searchText) => {
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
                i.id,
                bm25(images_fts) AS score,
                snippet(images_fts, 2, '<b>', '</b>', ' … ', 80) AS desc_match
            FROM images_fts
            JOIN images i ON i.id = images_fts.image_id
            WHERE images_fts MATCH ?
            ORDER BY score ASC
            LIMIT 5 OFFSET ?
        `);

        return stmt.all(finalQuery, 0);
    } catch (error) {
        throw new Error(`Failed to search image descriptions: ${error.message}`);
    }
};

/**
 * Searches the images FTS index using a looser query strategy.
 *
 * Broadens matching by using OR-based terms and optionally NEAR matching.
 * Useful for wider result discovery and pagination.
 *
 * @param {string} searchText - User-entered search text.
 * @param {number} [limit=50] - Maximum number of rows to return.
 * @param {number} [offset=0] - Result offset for pagination.
 * @returns {Array<Object>} Matching image rows with ranking score and description snippet.
 */
const searchImagesLooseByDescription = (searchText, limit = 50, offset = 0) => {
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
                i.id,
                bm25(images_fts) AS score,
                snippet(images_fts, 2, '<b>', '</b>', ' … ', 80) AS desc_match
            FROM images_fts
            JOIN images i ON i.id = images_fts.image_id
            WHERE images_fts MATCH ?
            ORDER BY score ASC
            LIMIT ? OFFSET ?
        `);

        return stmt.all(finalQuery, limit, offset);
    } catch (error) {
        throw new Error(`Failed to search image descriptions loosely: ${error.message}`);
    }
};

const getAllImageIds = () => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`SELECT id FROM images`);
        return stmt.all().map((row) => row.id);
    } catch (err) {
        throw new Error(`Failed to get all image ids: ${err.message}`);
    }
};

const getImageListWithoutDescription = () => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT id
            FROM images
            WHERE description IS NULL OR description = ''
        `);

        const images = stmt.all();

        return images.map((image) => image.id);
    } catch (err) {
        throw new Error(`Error getting images without description: ${err.message}`);
    }
};

/**
 * Returns titles and descriptions for a batch of image IDs.
 * Fetches both fields in one query to avoid 2 DB calls per image.
 * Callers should pass small batches (100-200 IDs) to keep memory low.
 *
 *  This is useful for any batch calls like in vocabular buiding and search
 *
 * @param {string[]} ids - Array of image IDs to fetch.
 * @returns {Array<{id: string, title: string|null, description: string|null}>}
 */
const getImageTitlesAndDescriptionsByIds = (ids = []) => {
    ensureDbInitialized();

    if (!ids.length) return [];

    try {
        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT id, title, description
            FROM images
            WHERE id IN (${placeholders})
        `);

        return stmt.all(...ids);
    } catch (err) {
        throw new Error(`Failed to fetch image titles and descriptions: ${err.message}`);
    }
};

/**
 * Reset all the fields in fromt he metaDatalist attribute for the given image IDs.
 * @param {*} ids
 * @param {*} metaDataList
 * @returns
 */
const resetImagesMetaData = (ids, metaDataList) => {
    ensureDbInitialized();

    if (!ids.length || !metaDataList.length) return;

    const metaList = metaDataList.map((meta) => {
        validateId(meta.id, 'id');
        return [meta.id, meta.title, meta.description, meta.embedding];
    });

    try {
        const stmt = db.prepare(`
            UPDATE images
            SET title =?, description =?
            WHERE id =?
        `);

        stmt.all(...metaList);
        // update cache of the given ids
        ids.forEach((id) => {
            imageDbCache.delete(id);
            descriptionCache.delete(id);
            imageEmbeddingCache.delete(id);
        });
        return true;
    } catch (err) {
        throw new Error(`Failed to reset image metadata: ${err.message}`);
    }
};

const clearImagesCache = () => {
    imageDbCache.clear();
    imageEmbeddingCache.clear();
    descriptionCache.clear();
};
const initializeDb = () => {
    db = getDb();
    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        imageDbCache.clear();
        imageEmbeddingCache.clear();
        descriptionCache.clear();
    });
    serviceEventBus.subscribe(interServiceEvents.INDEX_DATA_CHANGED, () => {
        imageDbCache.clear();
        imageEmbeddingCache.clear();
        descriptionCache.clear();
    });
    imageDbCache.clear();
    imageEmbeddingCache.clear();
    descriptionCache.clear();
};

module.exports = {
    getImageDetailsById,
    getImageDescriptionById,
    getAllImageIds,
    checkForDuplicateImage,
    addImage,
    updateImageDetails,
    deleteImageFromDb,
    checkImageExists,
    updateImageSource,
    updateImageDescription,

    clearImagesCache,
    getImagesByFileNameSearch,
    getImagesByTitleDbSearch,
    initializeDb,
    updateDescriptionAndEmbedding,
    getImageListWithoutDescription,
    getEmbeddingByImageId,
    searchImagesByDescription,
    searchImagesLooseByDescription,
    getImageTitlesAndDescriptionsByIds,
    resetImagesMetaData,
};
