const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');

const interServiceEvents = require('../../events/interServiceEvents');
const { getDb } = require('./database');
const { MAX_SHORT_DESCRIPTION_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_TRANSCRIPT_LENGTH } = require('../../configs/appConfig');
const { buildNearQuery, cleanSearchTerms } = require('../service-utils/cleanSearchQuery');

let db;

// keep small amount of data for metadata, as the data may be big
const META_DATA_CACHE_SIZE = 100;
const metadataCache = new LRUCache(META_DATA_CACHE_SIZE);

// keep a separate cache for embeddings, as vectors are larger and accessed differently
const EMBEDDING_CACHE_SIZE = 1000;
const embeddingCache = new LRUCache(EMBEDDING_CACHE_SIZE);

// keep resonable amount of data for shortDescription which is derived from metaData
const SHORT_DESC_CACHE_SIZE = 5000;
const shortDescCache = new LRUCache(SHORT_DESC_CACHE_SIZE);

/**
 * Initializes the metadata database service and cache state.
 *
 * This function loads the current database instance and clears all metadata-
 * related caches. It also subscribes to the database initialization event so
 * that if the DB instance changes later, the service updates its internal
 * reference and clears stale cache entries.
 *
 * @returns {void}
 */
const initializeMetadataDbService = () => {
    db = getDb();
    metadataCache.clear();
    embeddingCache.clear();
    shortDescCache.clear();
    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        metadataCache.clear();
        embeddingCache.clear();
        shortDescCache.clear();
    });
};

/**
 * Ensures the database connection has been initialized before use.
 *
 * @throws {Error} Throws if the database has not been initialized.
 * @returns {*} Active database instance.
 */
const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return db;
};

/**
 * Validates a description string before saving it to the database.
 *
 * @param {string} desc - Description text to validate.
 * @throws {Error} Throws if the description is empty, invalid, or exceeds the configured maximum length.
 * @returns {void}
 */
const validateDescription = (desc) => {
    if (!desc || typeof desc !== 'string' || desc.trim() === '') {
        throw new Error('Field name must be a non-empty string');
    }
    if (desc.length > MAX_DESCRIPTION_LENGTH) {
        throw new Error(`Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
    }
};

/**
 * Searches metadata using a stricter query strategy.
 *
 * For multi-word searches, the query prefers exact-token matches and also
 * attempts a NEAR query where possible. For a single sufficiently long word,
 * prefix matching is also included.
 *
 * @param {string} searchText - User-entered search text.
 * @returns {Array<Object>} Matching video rows with ranking score and snippets.
 */
const searchFromMetaData = (searchText) => {
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
                v.id,
                bm25(videos_fts) AS score,
                snippet(videos_fts, 2, '<b>', '</b>', ' … ', 80) AS desc_match,
                snippet(videos_fts, 3, '<b>', '</b>', ' … ', 120) AS transcript_match
            
            FROM videos_fts
            JOIN videos v ON v.id = videos_fts.video_id
            WHERE videos_fts MATCH ?
            
            ORDER BY score ASC
            LIMIT 5 OFFSET ?
        `);

        return stmt.all(finalQuery, 0);
    } catch (error) {
        throw new Error(`Failed to search in content: ${error.message}`);
    }
};

/**
 * Searches metadata using a looser query strategy.
 *
 * Compared with `searchFromMetaData`, this method broadens matching by using
 * OR-based terms and optionally NEAR matching. Useful for wider search result
 * discovery and pagination.
 *
 * @param {string} searchText - User-entered search text.
 * @param {number} [limit=50] - Maximum number of rows to return.
 * @param {number} [offset=0] - Result offset for pagination.
 * @returns {Array<Object>} Matching video rows with ranking score and snippets.
 */
const searchLooseFromMetaData = (searchText, limit = 50, offset = 0) => {
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
                v.id,
                bm25(videos_fts) AS score,
                snippet(videos_fts, 2, '<b>', '</b>', ' … ', 80) AS desc_match,
                snippet(videos_fts, 3, '<b>', '</b>', ' … ', 120) AS transcript_match
            FROM videos_fts
            JOIN videos v ON v.id = videos_fts.video_id
            WHERE videos_fts MATCH ?
            ORDER BY score ASC
            LIMIT ? OFFSET ?
        `);

        return stmt.all(finalQuery, limit, offset);
    } catch (error) {
        throw new Error(`Failed to search loose metadata content: ${error.message}`);
    }
};

/**
 * Creates or updates a description entry for a video.
 *
 * If metadata already exists for the video, the row is updated. Otherwise a new
 * metadata row is inserted. Relevant caches are invalidated on successful write.
 *
 * @param {string|number} videoId - Unique video identifier.
 * @param {string} description - Description text to store.
 * @param {string} [description_source='ai'] - Source label for the description.
 * @returns {{videoId: string|number, description: string, updatedAt: number}} Saved description payload.
 */
const setDescription = (videoId, description, description_source = 'ai') => {
    ensureDbInitialized();
    validateDescription(description);

    const updatedAt = Date.now();

    try {
        const updateStmt = db.prepare(`
            UPDATE  video_metadata
            SET     description          = ?,
                    description_source   = ?,
                    updated_at           = ?
            WHERE   video_id             = ?
        `);

        const insertStmt = db.prepare(`
            INSERT INTO video_metadata (video_id, description, description_source, updated_at)
            VALUES (?,?,?,?)
        `);

        const info = db.transaction(() => {
            const updated = updateStmt.run(description, description_source, updatedAt, videoId);

            if (updated.changes === 0) {
                return insertStmt.run(videoId, description, description_source, updatedAt);
            }
            return updated;
        })();

        if (info.changes > 0) {
            metadataCache.delete(videoId);
            embeddingCache.delete(videoId);
            shortDescCache.delete(videoId);
        }

        return { videoId, description, updatedAt };
    } catch (error) {
        throw new Error(`Failed to set description: ${error.message}`);
    }
};

/**
 * Creates or updates a full generated metadata record for a video.
 *
 * This method stores description, normalized description, embedding data,
 * transcript, and their source labels in a single transaction-like operation.
 * Relevant caches are invalidated on successful write.
 *
 * @param {string|number} videoId - Unique video identifier.
 * @param {Object} [metaData={}] - Metadata object to persist.
 * @param {string} [metaData.description] - Description text.
 * @param {string} [metaData.descriptionSource] - Source of the description.
 * @param {string} [metaData.normalizedDescription] - Normalized description string.
 * @param {Array<number>} [metaData.embedding] - Description embedding vector.
 * @param {string} [metaData.audioTranscript] - Transcript text.
 * @param {string} [metaData.audioTranscriptSource] - Source of the transcript.
 * @returns {Object} Saved metadata payload.
 */
const setGeneratedVideoMetaData = (videoId, metaData = {}) => {
    ensureDbInitialized();

    if (!videoId) {
        throw new Error('videoId is required');
    }

    const description = typeof metaData.description === 'string' ? metaData.description : '';
    const descriptionSource = typeof metaData.descriptionSource === 'string' ? metaData.descriptionSource.trim() : 'AI';
    const normalizedDescription = typeof metaData.normalizedDescription === 'string' ? metaData.normalizedDescription : '';
    const embedding = Array.isArray(metaData.embedding) ? JSON.stringify(metaData.embedding) : null;
    const transcript = typeof metaData.audioTranscript === 'string' ? metaData.audioTranscript.trim() : '';
    const transcriptSource = typeof metaData.audioTranscriptSource === 'string' ? metaData.audioTranscriptSource.trim() : 'AI';

    validateDescription(description);

    const updatedAt = Date.now();

    try {
        const updateStmt = db.prepare(`
            UPDATE  video_metadata
            SET     description              = ?,
                    description_source       = ?,
                    normalized_description   = ?,
                    description_embedding    = ?,
                    transcript               = ?,
                    transcript_source        = ?,
                    updated_at               = ?
            WHERE   video_id                 = ?
        `);

        const insertStmt = db.prepare(`
            INSERT INTO video_metadata (
                video_id,
                description,
                description_source,
                normalized_description,
                description_embedding,
                transcript,
                transcript_source,
                updated_at
            )
            VALUES (?,?,?,?,?,?,?,?)
        `);

        const info = db.transaction(() => {
            const updated = updateStmt.run(
                description,
                descriptionSource,
                normalizedDescription,
                embedding,
                transcript,
                transcriptSource,
                updatedAt,
                videoId,
            );

            if (updated.changes === 0) {
                return insertStmt.run(
                    videoId,
                    description,
                    descriptionSource,
                    normalizedDescription,
                    embedding,
                    transcript,
                    transcriptSource,
                    updatedAt,
                );
            }

            return updated;
        })();

        if (info.changes > 0) {
            metadataCache.delete(videoId);
            embeddingCache.delete(videoId);
            shortDescCache.delete(videoId);
        }

        return {
            videoId,
            description,
            descriptionSource,
            normalizedDescription,
            embedding,
            transcript,
            transcriptSource,
            updatedAt,
        };
    } catch (error) {
        throw new Error(`Failed to set save video metadata: ${error.message}`);
    }
};

/**
 * Creates or updates normalized description and embedding data for a video.
 *
 * This is useful when embedding generation is performed separately from the
 * rest of the metadata generation flow.
 *
 * @param {string|number} videoId - Unique video identifier.
 * @param {Object} [metaData={}] - Embedding payload.
 * @param {string} [metaData.normalizedDescription] - Normalized description text.
 * @param {Array<number>} [metaData.embedding] - Embedding vector.
 * @returns {Object} Saved embedding payload.
 */
const setEmbeddingData = (videoId, metaData = {}) => {
    ensureDbInitialized();

    if (!videoId) {
        throw new Error('videoId is required');
    }

    const normalizedDescription = typeof metaData.normalizedDescription === 'string' ? metaData.normalizedDescription : '';
    const embedding = Array.isArray(metaData.embedding) ? JSON.stringify(metaData.embedding) : null;
    const updatedAt = Date.now();

    try {
        const updateStmt = db.prepare(`
            UPDATE  video_metadata
            SET     normalized_description   = ?,
                    description_embedding    = ?,
                    updated_at               = ?
            WHERE   video_id                 = ?
        `);

        const insertStmt = db.prepare(`
            INSERT INTO video_metadata (
                video_id,
                normalized_description,
                description_embedding,
                updated_at
            )
            VALUES (?,?,?,?)
        `);

        const info = db.transaction(() => {
            const updated = updateStmt.run(normalizedDescription, embedding, updatedAt, videoId);

            if (updated.changes === 0) {
                return insertStmt.run(videoId, normalizedDescription, embedding, updatedAt);
            }

            return updated;
        })();

        if (info.changes > 0) {
            metadataCache.delete(videoId);
            embeddingCache.delete(videoId);
            shortDescCache.delete(videoId);
        }

        return {
            videoId,
            normalizedDescription,
            embedding,
            updatedAt,
        };
    } catch (error) {
        throw new Error(`Failed to set embedding data: ${error.message}`);
    }
};

/**
 * Returns a truncated description for a video.
 *
 * This value is cached separately because it is derived frequently from the
 * full metadata record and is comparatively small.
 *
 * @param {string|number} videoId - Unique video identifier.
 * @returns {string} Short description string.
 */
const getShortVideoDescriptionById = (videoId) => {
    const descInCache = shortDescCache.get(videoId);
    if (descInCache) return descInCache;

    const description = getDescriptionById(videoId);
    const shortDesc = description.slice(0, MAX_SHORT_DESCRIPTION_LENGTH);
    shortDescCache.set(videoId, shortDesc);
    return shortDesc;
};

/**
 * Creates or updates the transcript for a video.
 *
 * Transcript input is normalized to a string, truncated to the configured
 * maximum size, and then stored in the `video_metadata` table.
 *
 * @param {string|number} video_id - Unique video identifier.
 * @param {*} transcript - Transcript value to store.
 * @param {string} [source=''] - Transcript source label.
 * @returns {{videoId: string|number, transcript: string, updatedAt: number}} Saved transcript payload.
 */
const setAudioTranscript = (video_id, transcript, source = '') => {
    ensureDbInitialized();
    if (!video_id) {
        throw new Error('video_id is required');
    }

    let transcriptText = '';
    if (typeof transcript === 'string') {
        transcriptText = transcript;
    } else if (transcript == null) {
        transcriptText = '';
    } else {
        transcriptText = String(transcript);
    }

    if (transcriptText.length > MAX_TRANSCRIPT_LENGTH) {
        transcriptText = transcriptText.slice(0, MAX_TRANSCRIPT_LENGTH);
    }

    const updatedAt = Date.now();

    try {
        // Store on the same `video_metadata` table (latest row per video_id).
        // If a row already exists, update it; otherwise insert.
        const updateStmt = db.prepare(`
            UPDATE  video_metadata
            SET     transcript           = ?, 
                    transcript_source    = ?,
                    updated_at           = ?
            WHERE   video_id             = ?
        `);

        const insertStmt = db.prepare(`
            INSERT INTO video_metadata (video_id, transcript, transcript_source, updated_at)
            VALUES (?,?,?,?)
        `);

        const info = db.transaction(() => {
            const updated = updateStmt.run(transcriptText, source, updatedAt, video_id);

            if (updated.changes === 0) {
                return insertStmt.run(video_id, transcriptText, source, updatedAt);
            }
            return updated;
        })();

        if (info.changes > 0) {
            metadataCache.delete(video_id);
            embeddingCache.delete(video_id);
        }

        return { videoId: video_id, transcript: transcriptText, updatedAt };
    } catch (error) {
        throw new Error(`Failed to set audio transcript: ${error.message}`);
    }
};

/**
 * Returns the metadata record for a given video.
 *
 * The normalized response shape is cached for repeat reads.
 *
 * @param {string|number} videoId - Unique video identifier.
 * @returns {{
 *   description: string,
 *   descriptionSource: string,
 *   normalizedDescription: string,
 *   embedding: Array<number>,
 *   transcript: string,
 *   transcriptSource: string
 * }} Normalized metadata record.
 */
const getMetaDataById = (videoId) => {
    ensureDbInitialized();

    const cached = metadataCache.get(videoId);

    if (cached) {
        return {
            description: cached.description ?? '',
            descriptionSource: cached.description_source ?? '',
            normalizedDescription: cached.normalized_description ?? '',
            embedding: cached.description_embedding ? JSON.parse(cached.description_embedding) : [],
            transcript: cached.transcript ?? '',
            transcriptSource: cached.transcript_source ?? '',
        };
    }

    try {
        const stmt = db.prepare(`
            SELECT 
                
                description,
                description_source,
                normalized_description,
                description_embedding,
                transcript,
                transcript_source
            FROM video_metadata
            WHERE video_id = ?
            LIMIT 1
        `);

        const row = stmt.get(videoId);

        const normalized = {
            description: row?.description ?? '',
            descriptionSource: row?.description_source ?? '',
            normalizedDescription: row?.normalized_description ?? '',
            embedding: row?.description_embedding ? JSON.parse(row.description_embedding) : [],
            transcript: row?.transcript ?? '',
            transcriptSource: row?.transcript_source ?? '',
        };

        metadataCache.set(videoId, {
            description: normalized.description,
            description_source: normalized.descriptionSource,
            normalized_description: normalized.normalizedDescription,
            description_embedding: row?.description_embedding ?? null,
            transcript: normalized.transcript,
            transcript_source: normalized.transcriptSource,
        });

        return normalized;
    } catch (error) {
        throw new Error(`Failed to get metadata by id: ${error.message}`);
    }
};

/**
 * Returns descriptions for a batch of video IDs.
 *
 * This is primarily used by related-video indexing and similarity workflows.
 *
 * @param {Array<string|number>} arrVideoIds - List of video IDs to fetch.
 * @returns {Promise<Array<{videoId: string|number, description: string}>>} Description records.
 */
const getVideoDescriptionsChunk = async (arrVideoIds) => {
    ensureDbInitialized();

    try {
        const stmt = db.prepare(`
            SELECT video_id, description
            FROM video_metadata
            WHERE video_id IN (${arrVideoIds.map(() => '?').join(',')})
        `);

        const rows = stmt.all(...arrVideoIds);

        return rows.map((row) => ({
            videoId: row.video_id,
            description: row.description,
        }));
    } catch (error) {
        throw new Error(`Failed to get video descriptions chunk: ${error.message}`);
    }
};

/**
 * Returns the parsed embedding vector for a given video.
 *
 * Embeddings are cached independently because they are larger than most other
 * metadata and are often accessed by similarity-related features.
 *
 * @param {string|number} videoId - Unique video identifier.
 * @returns {Array<number>} Parsed embedding vector.
 */
const getEmbeddingByVideoId = (videoId) => {
    ensureDbInitialized();

    const cachedEmbedding = embeddingCache.get(videoId);
    if (typeof cachedEmbedding !== 'undefined') {
        return cachedEmbedding;
    }

    try {
        const stmt = db.prepare(`
            SELECT description_embedding
            FROM video_metadata
            WHERE video_id = ?
            LIMIT 1
        `);

        const row = stmt.get(videoId);
        const embedding = row?.description_embedding ? JSON.parse(row.description_embedding) : [];

        embeddingCache.set(videoId, embedding);

        return embedding;
    } catch (error) {
        throw new Error(`Failed to get embedding by id: ${error.message}`);
    }
};

/**
 * Returns the stored description for a given video.
 *
 * @param {string|number} videoId - Unique video identifier.
 * @returns {string} Video description.
 */
const getDescriptionById = (videoId) => {
    const meta = getMetaDataById(videoId);
    return meta.description;
};

/**
 * Returns the stored audio transcript for a given video.
 *
 * @param {string|number} videoId - Unique video identifier.
 * @returns {string} Video transcript.
 */
const getAudiotranscriptById = (videoId) => {
    const meta = getMetaDataById(videoId);
    return meta.transcript;
};

const resetMetaData = (videoIds) => {
    ensureDbInitialized();
    if (!Array.isArray(videoIds) || !videoIds.length) {
        throw new Error('Invalid videoIds');
    }

    try {
        const stmt = db.prepare(`
            UPDATE video_metadata
            SET description =?, description_source =?, normalized_description =?, description_embedding =?, transcript =?, transcript_source =?
            WHERE video_id IN (${videoIds.map(() => '?').join(',')})
        `);

        stmt.run('', '', '', null, '', '', ...videoIds);

        metadataCache.clear();
        embeddingCache.clear();

        return true;
    } catch (error) {
        throw new Error(`${error.message}`);
    }
};

module.exports = {
    initializeMetadataDbService,

    // get
    getMetaDataById,
    getDescriptionById,
    getAudiotranscriptById,
    getShortVideoDescriptionById,
    getEmbeddingByVideoId,

    // set
    setAudioTranscript,
    setDescription,
    setGeneratedVideoMetaData,
    setEmbeddingData,
    resetMetaData,

    // search
    searchFromMetaData,
    searchLooseFromMetaData,
    getVideoDescriptionsChunk,
};
