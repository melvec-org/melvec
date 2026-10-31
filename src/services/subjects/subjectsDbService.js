const path = require('path');
const { getDb } = require('../database/database');
const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const mediaTypes = require('../../constants/mediaTypes');
const { getFacesPath } = require('../servicePathConfig');

const FACES_BY_MEDIA_ID_CACHE_SIZE = 1000;
const PENDING_SUBJECT_CANDIDATE_STATUS = 'pending';
const IDENTIFIED_SUBJECT_CANDIDATE_STATUS = 'identified';
const facesByMediaIdCache = new LRUCache(FACES_BY_MEDIA_ID_CACHE_SIZE);

let subjectNamesCache = null;

let db = null;

const clearSubjectsDbCache = () => {
    subjectNamesCache = null;
    facesByMediaIdCache.clear();
};

const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDb first.');
    }
};

const initializeDb = () => {
    db = getDb();

    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
        clearSubjectsDbCache();
    });

    serviceEventBus.subscribe(interServiceEvents.INDEX_DATA_CHANGED, () => {
        clearSubjectsDbCache();
    });

    clearSubjectsDbCache();
};

const updateSubject = (id, name) => {
    ensureDbInitialized();

    if (!Number.isInteger(id)) {
        throw new Error('Subject id must be a valid integer');
    }

    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedName) {
        throw new Error('Subject name must be a non-empty string');
    }

    const result = db
        .prepare(
            `
            UPDATE subjects
            SET name = @name
            WHERE id = @id
        `,
        )
        .run({ id, name: normalizedName });

    clearSubjectsDbCache();

    return {
        id,
        name: normalizedName,
        updated: result.changes > 0,
    };
};

const createSubject = (name) => {
    ensureDbInitialized();

    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedName) {
        throw new Error('Subject name must be a non-empty string');
    }

    const result = db
        .prepare(
            `
            INSERT INTO subjects (name)
            VALUES (@name)
        `,
        )
        .run({ name: normalizedName });

    clearSubjectsDbCache();

    return {
        id: result.lastInsertRowid,
        name: normalizedName,
    };
};

const deleteSubject = (id) => {};

/**
 * These methods are to be used for searching,
 * The results should be cached
 */
const getAllSubjects = () => {
    ensureDbInitialized();

    if (Array.isArray(subjectNamesCache)) {
        return subjectNamesCache;
    }

    // fetch all subject names
    const stmt = db.prepare(
        `
            SELECT id, name
            FROM subjects
        `,
    );

    subjectNamesCache = stmt.all().flatMap(({ id, name }) => {
        const subjectNames = [];

        if (name) {
            subjectNames.push({ id, name });
        }

        return subjectNames;
    });

    return Array.isArray(subjectNamesCache) ? subjectNamesCache : [];
};

/**
 * Returns media associated with an identified subject.
 *
 * Subject-media membership is derived through permanent identified subject candidates:
 * `subjects_candidates.subject_id` -> `subject_candidates_images` / `subject_candidates_videos`.
 * Direct subject-media tables are not used.
 *
 * @param {number} subjectId Subject identifier.
 * @returns {Array<{mediaType: string, id: string}>} Media items associated with the subject.
 */
const getMediaIdsBySubjectId = (subjectId) => {
    ensureDbInitialized();

    if (!Number.isInteger(subjectId)) {
        throw new Error('SubjectsDbService: subject id should be an intiger');
    }

    const imageStmt = db.prepare(`
        SELECT DISTINCT sci.image_id AS mediaId
        FROM subjects_candidates sc
        INNER JOIN subject_candidates_images sci ON sci.candidate_id = sc.id
        WHERE sc.subject_id = @subjectId
          AND sc.status = @status
    `);

    const videoStmt = db.prepare(`
        SELECT DISTINCT scv.video_id AS mediaId
        FROM subjects_candidates sc
        INNER JOIN subject_candidates_videos scv ON scv.candidate_id = sc.id
        WHERE sc.subject_id = @subjectId
          AND sc.status = @status
    `);

    const params = { subjectId, status: IDENTIFIED_SUBJECT_CANDIDATE_STATUS };

    return [
        ...imageStmt.all(params).map(({ mediaId }) => ({ mediaType: mediaTypes.IMAGE, id: mediaId })),
        ...videoStmt.all(params).map(({ mediaId }) => ({ mediaType: mediaTypes.VIDEO, id: mediaId })),
    ];
};

// getMediaBySubjects is something that gets pulled by search where candidate identification is done.
const getMediaBySubjects = (subjects) => {
    return subjects.map((item) => getMediaIdsBySubjectId(item.id)).flat();
};

// add face

/**
 * Persists a face record to the database.
 *
 * The face image path is NOT stored — it is always derived at read time
 * as `._fc_/<faceId>.jpg` via `getFaceImagePath(id)`.
 *
 * @param {string} faceId    - Unique face ID (mediaId derived from imagePath).
 * @param {string} mediaId   - Source media ID this face was extracted from.
 * @param {number} confidence - YuNet detection confidence score.
 * @param {Array}  embedding  - SFace feature vector.
 */
const addFace = (faceId, mediaId, confidence, embedding = []) => {
    ensureDbInitialized();

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO faces (
            id,
            media_id,
            embedding,
            confidence
        ) VALUES (
            @id,
            @mediaId,
            @embedding,
            @confidence
        )
    `);

    let result;
    try {
        result = stmt.run({
            id: faceId,
            mediaId,
            embedding: Buffer.from(JSON.stringify(embedding)),
            confidence,
        });
        facesByMediaIdCache.delete(mediaId);
    } catch (err) {
        throw err;
    }

    return {
        id: faceId,
        mediaId,
        confidence,
        embedding,
    };
};

const deleteFace = (faceId) => {
    ensureDbInitialized();

    const existingFace = db
        .prepare(
            `
            SELECT media_id
            FROM faces
            WHERE id = @id
        `,
        )
        .get({ id: faceId });

    const stmt = db.prepare(`
        DELETE FROM faces
        WHERE id = @id
    `);

    const result = stmt.run({
        id: faceId,
    });

    if (existingFace) {
        facesByMediaIdCache.delete(existingFace.media_id);
    }

    return {
        deleted: result.changes > 0,
        id: faceId,
    };
};

/**
 * Returns all face records associated with a given source media ID.
 * The imagePath is derived from the face id — never stored in the DB.
 *
 * @param {string} mediaId - Source media ID.
 * @param {boolean} skipCache - When true, bypasses the in-memory DB cache.
 * @returns {Array<{id, imagePath, confidence}>}
 */
const getFacesByMediaId = (mediaId, skipCache = false) => {
    ensureDbInitialized();

    const cachedFaces = facesByMediaIdCache.get(mediaId);
    if (typeof cachedFaces !== 'undefined' && skipCache === false) {
        return cachedFaces;
    }

    const stmt = db.prepare(`
        SELECT id, confidence
        FROM faces
        WHERE media_id = @mediaId
    `);

    const faces = stmt.all({ mediaId }).map((face) => ({
        ...face,
        imagePath: path.join(getFacesPath(), `${face.id}.jpg`),
    }));

    facesByMediaIdCache.set(mediaId, faces);

    return faces;
};

const getSubjectsCandiatesByMediaId = (mediaType, mediaId) => {
    ensureDbInitialized();

    let mediaTable;
    let mediaIdColumn;

    if (mediaType === mediaTypes.VIDEO) {
        mediaTable = 'subject_candidates_videos';
        mediaIdColumn = 'video_id';
    } else if (mediaType === mediaTypes.IMAGE) {
        mediaTable = 'subject_candidates_images';
        mediaIdColumn = 'image_id';
    } else {
        throw new Error(`Unsupported media type for subject candidate lookup: ${mediaType}`);
    }

    const rows = db
        .prepare(
            `
            SELECT
                sc.id AS candidateId,
                sc.status AS status,
                sc.subject_id AS subjectId,
                s.name AS subjectName,
                f.id AS faceId,
                f.confidence AS confidence,
                scf.is_representative AS isRepresentative,
                scf.representative_rank AS representativeRank
            FROM ${mediaTable} scm
            INNER JOIN subjects_candidates sc ON sc.id = scm.candidate_id
            LEFT JOIN subjects s ON s.id = sc.subject_id
            LEFT JOIN subject_candidate_faces scf ON scf.candidate_id = sc.id
            LEFT JOIN faces f ON f.id = scf.face_id
            WHERE scm.${mediaIdColumn} = @mediaId
            ORDER BY
                sc.id DESC,
                scf.is_representative DESC,
                CASE WHEN scf.representative_rank IS NULL THEN 1 ELSE 0 END,
                scf.representative_rank ASC,
                f.confidence DESC
        `,
        )
        .all({ mediaId });

    return mapSubjectCandidateClusterRows(rows, { includeSubjectName: true });
};

/**
 * Deletes all face records associated with a given source media ID.
 *
 * @param {string} mediaId - Source media ID.
 * @returns {{ deleted: number }} Number of rows deleted.
 */
const deleteFacesByMediaId = (mediaId) => {
    ensureDbInitialized();

    const stmt = db.prepare(`
        DELETE FROM faces
        WHERE media_id = @mediaId
    `);

    const result = stmt.run({ mediaId });

    facesByMediaIdCache.delete(mediaId);

    return { deleted: result.changes };
};

const parseEmbedding = (embedding) => {
    if (Array.isArray(embedding)) {
        return embedding;
    }

    if (Buffer.isBuffer(embedding)) {
        return JSON.parse(embedding.toString());
    }

    if (typeof embedding === 'string') {
        return JSON.parse(embedding);
    }

    return [];
};

const getPendingSubjectCandidateFaces = () => {
    ensureDbInitialized();

    const stmt = db.prepare(`
        SELECT
            scf.candidate_id AS candidateId,
            f.id AS faceId,
            f.embedding AS embedding,
            f.confidence AS confidence
        FROM subject_candidate_faces scf
        INNER JOIN subjects_candidates sc ON sc.id = scf.candidate_id
        INNER JOIN faces f ON f.id = scf.face_id
        WHERE sc.status = @status
          AND scf.is_representative = 1
    `);

    return stmt.all({ status: PENDING_SUBJECT_CANDIDATE_STATUS }).map((face) => ({
        ...face,
        embedding: parseEmbedding(face.embedding),
    }));
};

/**
 * Returns extracted faces that are not yet assigned to any subject candidate cluster.
 *
 * Media type is inferred from the source media table so rebuilt candidate media links
 * are written to the correct candidate-media table. Since identified subjects are now
 * represented by identified subject candidates, this excludes faces already present in
 * `subject_candidate_faces` rather than consulting direct subject-face associations.
 *
 * @returns {Array<{id: string, mediaId: string, mediaType: string, embedding: Array, confidence: number}>}
 */
const getFacesForSubjectCandidateClustering = () => {
    ensureDbInitialized();

    return db
        .prepare(
            `
            SELECT
                f.id AS id,
                f.media_id AS mediaId,
                f.embedding AS embedding,
                f.confidence AS confidence,
                CASE
                    WHEN v.id IS NOT NULL THEN @videoMediaType
                    ELSE @imageMediaType
                END AS mediaType
            FROM faces f
            LEFT JOIN videos v ON v.id = f.media_id
            LEFT JOIN images i ON i.id = f.media_id
            WHERE (v.id IS NOT NULL OR i.id IS NOT NULL)
              AND NOT EXISTS (
                SELECT 1
                FROM subject_candidate_faces scf
                WHERE scf.face_id = f.id
              )
            ORDER BY f.media_id, f.confidence DESC
        `,
        )
        .all({ imageMediaType: mediaTypes.IMAGE, videoMediaType: mediaTypes.VIDEO })
        .map((face) => ({
            ...face,
            embedding: parseEmbedding(face.embedding),
        }));
};

/**
 * Groups flattened subject-candidate SQL rows into cluster objects with their retained faces.
 *
 * The pending and identified cluster queries both return one row per candidate/face pair.
 * This mapper collapses those rows into one candidate object per cluster and derives
 * `faceCount` from the number of linked face rows.
 *
 * @param {Array<object>} rows Flattened rows from a subject-candidate cluster query.
 * @param {object} [options]
 * @param {boolean} [options.includeSubjectName=false] Include the joined subject name on each candidate.
 * @returns {Array<{id: number, status: string, subjectId: number|null, name?: string, faceCount: number, faces: Array<object>}>}
 */
const mapSubjectCandidateClusterRows = (rows, options = {}) => {
    const { includeSubjectName = false } = options;
    const candidateMap = new Map();

    rows.forEach(
        ({ candidateId, status: candidateStatus, subjectId, subjectName, faceId, confidence, isRepresentative, representativeRank }) => {
            if (!candidateMap.has(candidateId)) {
                const candidate = {
                    id: candidateId,
                    status: candidateStatus,
                    subjectId,
                    faceCount: 0,
                    faces: [],
                };

                if (includeSubjectName) {
                    candidate.name = subjectName || '';
                }

                candidateMap.set(candidateId, candidate);
            }

            if (faceId) {
                const candidate = candidateMap.get(candidateId);
                candidate.faceCount += 1;
                candidate.faces.push({
                    id: faceId,
                    confidence,
                    isRepresentative: Boolean(isRepresentative),
                    representativeRank,
                    imagePath: path.join(getFacesPath(), `${faceId}.jpg`),
                });
            }
        },
    );

    return Array.from(candidateMap.values());
};

/**
 * Fetches pending subject candidate clusters.
 *
 * Pending candidates are not linked to canonical subjects yet, so this query intentionally
 * does not join the `subjects` table and does not return a subject name.
 *
 * @returns {Array<{id: number, status: 'pending', subjectId: null, faceCount: number, faces: Array<object>}>}
 */
const getPendingSubjectCandidateClusters = () => {
    const rows = db
        .prepare(
            `
            SELECT
                sc.id AS candidateId,
                sc.status AS status,
                sc.subject_id AS subjectId,
                f.id AS faceId,
                f.confidence AS confidence,
                scf.is_representative AS isRepresentative,
                scf.representative_rank AS representativeRank
            FROM subjects_candidates sc
            LEFT JOIN subject_candidate_faces scf ON scf.candidate_id = sc.id
            LEFT JOIN faces f ON f.id = scf.face_id
            WHERE sc.status = @status
            ORDER BY
                sc.id DESC,
                scf.is_representative DESC,
                CASE WHEN scf.representative_rank IS NULL THEN 1 ELSE 0 END,
                scf.representative_rank ASC,
                f.confidence DESC
        `,
        )
        .all({ status: PENDING_SUBJECT_CANDIDATE_STATUS });

    return mapSubjectCandidateClusterRows(rows);
};

/**
 * Fetches identified subject candidate clusters with their canonical subject name.
 *
 * Identified candidates are linked through `subjects_candidates.subject_id`, so this query
 * joins `subjects` and returns `name` on each candidate cluster.
 *
 * @returns {Array<{id: number, status: 'identified', subjectId: number, name: string, faceCount: number, faces: Array<object>}>}
 */
const getIdentifiedSubjectCandidateClusters = () => {
    const rows = db
        .prepare(
            `
            SELECT
                sc.id AS candidateId,
                sc.status AS status,
                sc.subject_id AS subjectId,
                s.name AS subjectName,
                f.id AS faceId,
                f.confidence AS confidence,
                scf.is_representative AS isRepresentative,
                scf.representative_rank AS representativeRank
            FROM subjects_candidates sc
            INNER JOIN subjects s ON s.id = sc.subject_id
            LEFT JOIN subject_candidate_faces scf ON scf.candidate_id = sc.id
            LEFT JOIN faces f ON f.id = scf.face_id
            WHERE sc.status = @status
            ORDER BY
                sc.id DESC,
                scf.is_representative DESC,
                CASE WHEN scf.representative_rank IS NULL THEN 1 ELSE 0 END,
                scf.representative_rank ASC,
                f.confidence DESC
        `,
        )
        .all({ status: IDENTIFIED_SUBJECT_CANDIDATE_STATUS });

    return mapSubjectCandidateClusterRows(rows, { includeSubjectName: true });
};

/**
 * Fetches subject candidate clusters by candidate type.
 *
 * This is the public DB entry point for the review UI. It switches to the lean pending
 * query for unresolved candidates and to the identified query when subject names are needed.
 * Callers should pass only validated candidate types.
 *
 * @param {'pending'|'identified'} [candidateType='pending'] Subject candidate type to fetch.
 * @returns {Array<object>} Subject candidate clusters for the requested type.
 * @throws {Error} When the database is not initialized or candidateType is unsupported.
 */
const getSubjectCandidateClusters = (candidateType = PENDING_SUBJECT_CANDIDATE_STATUS) => {
    ensureDbInitialized();

    switch (candidateType) {
        case PENDING_SUBJECT_CANDIDATE_STATUS:
            return getPendingSubjectCandidateClusters();
        case IDENTIFIED_SUBJECT_CANDIDATE_STATUS:
            return getIdentifiedSubjectCandidateClusters();
        default:
            throw new Error(`Unsupported subject candidate type: ${candidateType}`);
    }
};

const createSubjectCandidate = (status = PENDING_SUBJECT_CANDIDATE_STATUS, subjectId = null) => {
    ensureDbInitialized();

    const result = db
        .prepare(
            `
            INSERT INTO subjects_candidates (status, subject_id)
            VALUES (@status, @subjectId)
        `,
        )
        .run({ status, subjectId });

    return {
        id: result.lastInsertRowid,
        status,
        subjectId,
    };
};

const identifySubjectCandidate = (candidateId, subjectId) => {
    ensureDbInitialized();

    if (!Number.isInteger(candidateId)) {
        throw new Error('Subject candidate id must be a valid integer');
    }

    if (!Number.isInteger(subjectId)) {
        throw new Error('Subject id must be a valid integer');
    }

    const result = db
        .prepare(
            `
            UPDATE subjects_candidates
            SET status = @status,
                subject_id = @subjectId
            WHERE id = @candidateId
        `,
        )
        .run({
            candidateId,
            subjectId,
            status: IDENTIFIED_SUBJECT_CANDIDATE_STATUS,
        });

    return {
        candidateId,
        subjectId,
        status: IDENTIFIED_SUBJECT_CANDIDATE_STATUS,
        updated: result.changes > 0,
    };
};

const addFaceToSubjectCandidate = (candidateId, faceId, options = {}) => {
    ensureDbInitialized();

    const { isRepresentative = true, representativeRank = null } = options;

    const result = db
        .prepare(
            `
            INSERT OR IGNORE INTO subject_candidate_faces (
                candidate_id,
                face_id,
                is_representative,
                representative_rank
            ) VALUES (
                @candidateId,
                @faceId,
                @isRepresentative,
                @representativeRank
            )
        `,
        )
        .run({
            candidateId,
            faceId,
            isRepresentative: isRepresentative ? 1 : 0,
            representativeRank,
        });

    return {
        candidateId,
        faceId,
        isRepresentative: Boolean(isRepresentative),
        representativeRank,
        added: result.changes > 0,
    };
};

const updateSubjectCandidateFaceRepresentatives = (candidateId, faceRepresentatives = []) => {
    ensureDbInitialized();

    if (!Number.isInteger(candidateId)) {
        throw new Error('Subject candidate id must be a valid integer');
    }

    if (!Array.isArray(faceRepresentatives)) {
        throw new Error('faceRepresentatives must be an array');
    }

    const transaction = db.transaction(() => {
        const updateStmt = db.prepare(`
            UPDATE subject_candidate_faces
            SET is_representative = @isRepresentative,
                representative_rank = @representativeRank
            WHERE candidate_id = @candidateId
              AND face_id = @faceId
        `);

        let updated = 0;

        for (const faceRepresentative of faceRepresentatives) {
            const faceId = faceRepresentative?.faceId || faceRepresentative?.id;

            if (!faceId) {
                throw new Error('Each face representative must include faceId or id');
            }

            const isRepresentative = faceRepresentative.isRepresentative !== false;
            const representativeRank = Number.isInteger(faceRepresentative.representativeRank)
                ? faceRepresentative.representativeRank
                : null;

            const result = updateStmt.run({
                candidateId,
                faceId,
                isRepresentative: isRepresentative ? 1 : 0,
                representativeRank,
            });

            updated += result.changes;
        }

        return {
            candidateId,
            updated,
        };
    });

    return transaction();
};

const addMediaToSubjectCandidate = (candidateId, mediaType, mediaId) => {
    ensureDbInitialized();

    if (mediaType === mediaTypes.VIDEO) {
        const result = db
            .prepare(
                `
                INSERT OR IGNORE INTO subject_candidates_videos (candidate_id, video_id)
                VALUES (@candidateId, @mediaId)
            `,
            )
            .run({ candidateId, mediaId });

        return { candidateId, mediaType, mediaId, added: result.changes > 0 };
    }

    if (mediaType === mediaTypes.IMAGE) {
        const result = db
            .prepare(
                `
                INSERT OR IGNORE INTO subject_candidates_images (candidate_id, image_id)
                VALUES (@candidateId, @mediaId)
            `,
            )
            .run({ candidateId, mediaId });

        return { candidateId, mediaType, mediaId, added: result.changes > 0 };
    }

    throw new Error(`Unsupported media type for subject candidate: ${mediaType}`);
};

/**
 * Creates a new unresolved subject candidate cluster and links its first face/media.
 *
 * Used when extracted face clustering cannot match a face to an existing subject
 * or pending candidate cluster.
 *
 * @param {string} faceId - Extracted face ID that starts the candidate cluster.
 * @param {string} mediaType - mediaTypes.VIDEO or mediaTypes.IMAGE.
 * @param {string} mediaId - Source media ID where the face was found.
 * @returns {{candidateId: number, faceId: string, mediaType: string, mediaId: string, created: boolean}}
 */
const createSubjectCandidateCluster = (faceId, mediaType, mediaId) => {
    ensureDbInitialized();

    const transaction = db.transaction(() => {
        const candidate = createSubjectCandidate();
        addFaceToSubjectCandidate(candidate.id, faceId);
        addMediaToSubjectCandidate(candidate.id, mediaType, mediaId);

        return {
            candidateId: candidate.id,
            faceId,
            mediaType,
            mediaId,
            created: true,
        };
    });

    return transaction();
};

/**
 * Adds a face/media occurrence to an existing unresolved subject candidate cluster.
 *
 * Used when candidate clustering finds that a newly extracted face likely belongs
 * to an existing pending candidate.
 *
 * @param {number} candidateId - Existing subject candidate cluster ID.
 * @param {string} faceId - Extracted face ID to attach to the cluster.
 * @param {string} mediaType - mediaTypes.VIDEO or mediaTypes.IMAGE.
 * @param {string} mediaId - Source media ID where the face was found.
 * @returns {{candidateId: number, faceId: string, mediaType: string, mediaId: string, updated: boolean}}
 */
const updateSubjectCandidateCluster = (candidateId, faceId, mediaType, mediaId) => {
    ensureDbInitialized();

    const transaction = db.transaction(() => {
        addFaceToSubjectCandidate(candidateId, faceId);
        addMediaToSubjectCandidate(candidateId, mediaType, mediaId);

        return {
            candidateId,
            faceId,
            mediaType,
            mediaId,
            updated: true,
        };
    });

    return transaction();
};

const mergeSubjectCandidateClusters = (candidateIds = []) => {
    ensureDbInitialized();

    const normalizedCandidateIds = [...new Set(candidateIds.map((candidateId) => Number(candidateId)).filter(Number.isInteger))];

    if (normalizedCandidateIds.length < 2) {
        throw new Error('At least two subject candidate ids are required to merge');
    }

    const placeholders = normalizedCandidateIds.map(() => '?').join(', ');
    const candidates = db
        .prepare(
            `
            SELECT
                id,
                status,
                subject_id AS subjectId
            FROM subjects_candidates
            WHERE id IN (${placeholders})
        `,
        )
        .all(...normalizedCandidateIds);

    if (candidates.length !== normalizedCandidateIds.length) {
        throw new Error('One or more subject candidates were not found');
    }

    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const identifiedCandidateIds = normalizedCandidateIds.filter(
        (candidateId) => candidateById.get(candidateId)?.status === IDENTIFIED_SUBJECT_CANDIDATE_STATUS,
    );

    if (identifiedCandidateIds.length > 1) {
        throw new Error('Cannot merge more than one identified subject candidate');
    }

    const targetCandidateId = identifiedCandidateIds[0] || normalizedCandidateIds[0];
    const sourceCandidateIds = normalizedCandidateIds.filter((candidateId) => candidateId !== targetCandidateId);

    const transaction = db.transaction(() => {
        const copyFacesStmt = db.prepare(`
            INSERT OR IGNORE INTO subject_candidate_faces (
                candidate_id,
                face_id,
                is_representative,
                representative_rank
            )
            SELECT
                @targetCandidateId,
                face_id,
                is_representative,
                representative_rank
            FROM subject_candidate_faces
            WHERE candidate_id = @sourceCandidateId
        `);

        const copyImagesStmt = db.prepare(`
            INSERT OR IGNORE INTO subject_candidates_images (candidate_id, image_id)
            SELECT @targetCandidateId, image_id
            FROM subject_candidates_images
            WHERE candidate_id = @sourceCandidateId
        `);

        const copyVideosStmt = db.prepare(`
            INSERT OR IGNORE INTO subject_candidates_videos (candidate_id, video_id)
            SELECT @targetCandidateId, video_id
            FROM subject_candidates_videos
            WHERE candidate_id = @sourceCandidateId
        `);

        const deleteFacesStmt = db.prepare('DELETE FROM subject_candidate_faces WHERE candidate_id = @sourceCandidateId');
        const deleteImagesStmt = db.prepare('DELETE FROM subject_candidates_images WHERE candidate_id = @sourceCandidateId');
        const deleteVideosStmt = db.prepare('DELETE FROM subject_candidates_videos WHERE candidate_id = @sourceCandidateId');
        const deleteCandidateStmt = db.prepare('DELETE FROM subjects_candidates WHERE id = @sourceCandidateId');

        let movedFaces = 0;
        let movedImages = 0;
        let movedVideos = 0;
        let deletedCandidates = 0;

        for (const sourceCandidateId of sourceCandidateIds) {
            const params = { targetCandidateId, sourceCandidateId };

            movedFaces += copyFacesStmt.run(params).changes;
            movedImages += copyImagesStmt.run(params).changes;
            movedVideos += copyVideosStmt.run(params).changes;

            deleteFacesStmt.run({ sourceCandidateId });
            deleteImagesStmt.run({ sourceCandidateId });
            deleteVideosStmt.run({ sourceCandidateId });
            deletedCandidates += deleteCandidateStmt.run({ sourceCandidateId }).changes;
        }

        return {
            targetCandidateId,
            mergedCandidateIds: sourceCandidateIds,
            deletedCandidates,
            movedFaces,
            movedImages,
            movedVideos,
        };
    });

    return transaction();
};

const splitSubjectCandidateCluster = (candidateId, faceIds = []) => {
    ensureDbInitialized();

    if (!Number.isInteger(candidateId)) {
        throw new Error('Subject candidate id must be a valid integer');
    }

    const normalizedFaceIds = [...new Set(faceIds.filter((faceId) => typeof faceId === 'string' && faceId.trim() !== ''))];

    if (normalizedFaceIds.length === 0) {
        throw new Error('At least one face id is required to split a subject candidate');
    }

    const transaction = db.transaction(() => {
        const candidate = db
            .prepare(
                `
                SELECT status, subject_id AS subjectId
                FROM subjects_candidates
                WHERE id = @candidateId
            `,
            )
            .get({ candidateId });

        if (!candidate) {
            throw new Error('Subject candidate was not found');
        }

        const faceIdParams = normalizedFaceIds.reduce((params, faceId, index) => {
            params[`faceId${index}`] = faceId;
            return params;
        }, {});
        const placeholders = Object.keys(faceIdParams)
            .map((paramName) => `@${paramName}`)
            .join(', ');
        const selectedFaces = db
            .prepare(
                `
                SELECT
                    scf.face_id AS faceId,
                    scf.is_representative AS isRepresentative,
                    scf.representative_rank AS representativeRank,
                    f.media_id AS mediaId,
                    CASE
                        WHEN v.id IS NOT NULL THEN @videoMediaType
                        ELSE @imageMediaType
                    END AS mediaType
                FROM subject_candidate_faces scf
                INNER JOIN faces f ON f.id = scf.face_id
                LEFT JOIN videos v ON v.id = f.media_id
                LEFT JOIN images i ON i.id = f.media_id
                WHERE scf.candidate_id = @candidateId
                  AND scf.face_id IN (${placeholders})
                  AND (v.id IS NOT NULL OR i.id IS NOT NULL)
            `,
            )
            .all({
                candidateId,
                imageMediaType: mediaTypes.IMAGE,
                videoMediaType: mediaTypes.VIDEO,
                ...faceIdParams,
            });

        if (selectedFaces.length !== normalizedFaceIds.length) {
            throw new Error('One or more faces were not found in the source subject candidate');
        }

        const newCandidate = createSubjectCandidate(candidate.status, candidate.subjectId);
        const deleteSourceFaceStmt = db.prepare(`
            DELETE FROM subject_candidate_faces
            WHERE candidate_id = @candidateId
              AND face_id = @faceId
        `);

        for (const face of selectedFaces) {
            addFaceToSubjectCandidate(newCandidate.id, face.faceId, {
                isRepresentative: Boolean(face.isRepresentative),
                representativeRank: face.representativeRank,
            });
            addMediaToSubjectCandidate(newCandidate.id, face.mediaType, face.mediaId);
            deleteSourceFaceStmt.run({ candidateId, faceId: face.faceId });
        }

        return {
            sourceCandidateId: candidateId,
            newCandidateId: newCandidate.id,
            status: newCandidate.status,
            subjectId: newCandidate.subjectId,
            movedFaceIds: selectedFaces.map(({ faceId }) => faceId),
            movedFaces: selectedFaces.length,
        };
    });

    return transaction();
};

/**
 * Finds the unresolved candidate cluster that contains a given face.
 *
 * Used by subject identification flows that start from a selected face thumbnail,
 * then need to promote/delete the whole candidate cluster.
 *
 * @param {string} faceId - Extracted face ID.
 * @returns {number|null} Candidate cluster ID, or null when the face is not in a candidate.
 */
const getSubjectCandidateIdByFaceId = (faceId) => {
    ensureDbInitialized();

    const row = db
        .prepare(
            `
            SELECT candidate_id AS candidateId
            FROM subject_candidate_faces
            WHERE face_id = @faceId
        `,
        )
        .get({ faceId });

    return row?.candidateId || null;
};

const getSubjectCandidateFaceIds = (candidateId) => {
    ensureDbInitialized();

    return db
        .prepare(
            `
            SELECT face_id AS faceId
            FROM subject_candidate_faces
            WHERE candidate_id = @candidateId
        `,
        )
        .all({ candidateId })
        .map(({ faceId }) => faceId);
};

const getSubjectCandidateFaces = (candidateId) => {
    ensureDbInitialized();

    return db
        .prepare(
            `
            SELECT
                f.id AS faceId,
                f.media_id AS mediaId,
                f.confidence AS confidence,
                scf.is_representative AS isRepresentative,
                scf.representative_rank AS representativeRank
            FROM subject_candidate_faces scf
            INNER JOIN faces f ON f.id = scf.face_id
            WHERE scf.candidate_id = @candidateId
            ORDER BY
                scf.is_representative DESC,
                CASE WHEN scf.representative_rank IS NULL THEN 1 ELSE 0 END,
                scf.representative_rank ASC,
                f.confidence DESC
        `,
        )
        .all({ candidateId })
        .map((face) => ({
            ...face,
            isRepresentative: Boolean(face.isRepresentative),
        }));
};

const getSubjectCandidateMediaIds = (candidateId) => {
    ensureDbInitialized();

    const images = db
        .prepare(
            `
            SELECT image_id AS mediaId
            FROM subject_candidates_images
            WHERE candidate_id = @candidateId
        `,
        )
        .all({ candidateId })
        .map(({ mediaId }) => ({ mediaType: mediaTypes.IMAGE, mediaId }));

    const videos = db
        .prepare(
            `
            SELECT video_id AS mediaId
            FROM subject_candidates_videos
            WHERE candidate_id = @candidateId
        `,
        )
        .all({ candidateId })
        .map(({ mediaId }) => ({ mediaType: mediaTypes.VIDEO, mediaId }));

    return [...images, ...videos];
};

const removeMediaFromSubjectCandidate = (candidateId, mediaType, mediaId) => {
    ensureDbInitialized();

    if (!Number.isInteger(candidateId)) {
        throw new Error('Subject candidate id must be a valid integer');
    }

    if (mediaType === mediaTypes.IMAGE) {
        const result = db
            .prepare(
                `
                DELETE FROM subject_candidates_images
                WHERE candidate_id = @candidateId
                  AND image_id = @mediaId
            `,
            )
            .run({ candidateId, mediaId });

        clearSubjectsDbCache();

        return { candidateId, mediaType, mediaId, removed: result.changes > 0 };
    }

    if (mediaType === mediaTypes.VIDEO) {
        const result = db
            .prepare(
                `
                DELETE FROM subject_candidates_videos
                WHERE candidate_id = @candidateId
                  AND video_id = @mediaId
            `,
            )
            .run({ candidateId, mediaId });

        clearSubjectsDbCache();

        return { candidateId, mediaType, mediaId, removed: result.changes > 0 };
    }

    throw new Error(`Unsupported media type for subject candidate media removal: ${mediaType}`);
};

const deleteFacesByIds = (faceIds = []) => {
    ensureDbInitialized();

    if (!Array.isArray(faceIds) || faceIds.length === 0) {
        return { deleted: 0, mediaIds: [] };
    }

    const placeholders = faceIds.map(() => '?').join(', ');
    const existingFaces = db.prepare(`SELECT id, media_id AS mediaId FROM faces WHERE id IN (${placeholders})`).all(...faceIds);
    const result = db.prepare(`DELETE FROM faces WHERE id IN (${placeholders})`).run(...faceIds);

    const mediaIds = [...new Set(existingFaces.map(({ mediaId }) => mediaId))];
    mediaIds.forEach((mediaId) => facesByMediaIdCache.delete(mediaId));

    return {
        deleted: result.changes,
        mediaIds,
    };
};

/**
 * Deletes a subject candidate cluster and its candidate workspace links.
 *
 * By default this preserves rows from `faces`, which is required when deleting a
 * source candidate after merging it into another candidate. Pass `deleteFaces: true`
 * only for explicit user actions that permanently remove the candidate's retained
 * face records as well.
 *
 * @param {number} candidateId - Candidate cluster ID to remove.
 * @param {{deleteFaces?: boolean}} [options]
 * @returns {{candidateId: number, deleted: boolean, deletedFaces: number, deletedImages: number, deletedVideos: number, deletedFaceRecords: number, faceIds: Array<string>}}
 */
const deleteSubjectCandidateCluster = (candidateId, options = {}) => {
    ensureDbInitialized();

    const { deleteFaces = false } = options;

    const transaction = db.transaction(() => {
        const faceIds = getSubjectCandidateFaceIds(candidateId);

        const deletedFaces = db
            .prepare(
                `
                DELETE FROM subject_candidate_faces
                WHERE candidate_id = @candidateId
            `,
            )
            .run({ candidateId });

        const deletedImages = db
            .prepare(
                `
                DELETE FROM subject_candidates_images
                WHERE candidate_id = @candidateId
            `,
            )
            .run({ candidateId });

        const deletedVideos = db
            .prepare(
                `
                DELETE FROM subject_candidates_videos
                WHERE candidate_id = @candidateId
            `,
            )
            .run({ candidateId });

        const deletedCandidate = db
            .prepare(
                `
                DELETE FROM subjects_candidates
                WHERE id = @candidateId
            `,
            )
            .run({ candidateId });

        const deletedFaceRecords = deleteFaces ? deleteFacesByIds(faceIds).deleted : 0;

        return {
            candidateId,
            deleted: deletedCandidate.changes > 0,
            deletedFaces: deletedFaces.changes,
            deletedImages: deletedImages.changes,
            deletedVideos: deletedVideos.changes,
            deletedFaceRecords,
            faceIds,
        };
    });

    return transaction();
};

/**
 * Deletes the unresolved candidate cluster that contains the provided face.
 *
 * Convenience wrapper for UI flows where the user action starts from a face
 * thumbnail instead of a known candidate ID.
 *
 * @param {string} faceId - Face ID whose candidate cluster should be removed.
 * @returns {{faceId: string, candidateId: number|null, deleted: boolean, deletedFaces?: number, deletedImages?: number, deletedVideos?: number}}
 */
const deleteSubjectCandidateClusterByFaceId = (faceId, options = {}) => {
    ensureDbInitialized();

    const candidateId = getSubjectCandidateIdByFaceId(faceId);

    if (!candidateId) {
        return {
            faceId,
            candidateId: null,
            deleted: false,
            faceIds: [],
        };
    }

    return {
        faceId,
        ...deleteSubjectCandidateCluster(candidateId, options),
    };
};

/**
 * Deletes all unresolved subject candidate clusters and workspace links.
 *
 * Extracted face rows are preserved so candidate clustering can be recreated with a different
 * threshold without re-running face extraction.
 *
 * @returns {{deletedCandidateFaces: number, deletedImages: number, deletedVideos: number, deletedCandidates: number}}
 */
const resetSubjectCandidateClusters = () => {
    ensureDbInitialized();

    const transaction = db.transaction(() => {
        const deletedCandidateFaces = db.prepare('DELETE FROM subject_candidate_faces').run();
        const deletedImages = db.prepare('DELETE FROM subject_candidates_images').run();
        const deletedVideos = db.prepare('DELETE FROM subject_candidates_videos').run();
        const deletedCandidates = db.prepare('DELETE FROM subjects_candidates').run();

        clearSubjectsDbCache();

        return {
            deletedCandidateFaces: deletedCandidateFaces.changes,
            deletedImages: deletedImages.changes,
            deletedVideos: deletedVideos.changes,
            deletedCandidates: deletedCandidates.changes,
        };
    });

    return transaction();
};

module.exports = {
    initializeDb,

    // read
    getAllSubjects,
    getMediaIdsBySubjectId,
    getFacesByMediaId,
    getMediaBySubjects,
    getSubjectsCandiatesByMediaId,
    getPendingSubjectCandidateFaces,
    getFacesForSubjectCandidateClustering,
    getSubjectCandidateClusters,
    getSubjectCandidateIdByFaceId,
    getSubjectCandidateFaceIds,
    getSubjectCandidateFaces,
    getSubjectCandidateMediaIds,

    // write
    addFace,
    createSubject,
    updateSubject,
    createSubjectCandidate,
    identifySubjectCandidate,
    addFaceToSubjectCandidate,
    updateSubjectCandidateFaceRepresentatives,
    addMediaToSubjectCandidate,
    createSubjectCandidateCluster,
    updateSubjectCandidateCluster,
    mergeSubjectCandidateClusters,
    splitSubjectCandidateCluster,

    // delete
    deleteFace,
    deleteFacesByMediaId,
    removeMediaFromSubjectCandidate,
    deleteSubjectCandidateCluster,
    deleteSubjectCandidateClusterByFaceId,
    resetSubjectCandidateClusters,

    // clean
    clearSubjectsDbCache,
};
