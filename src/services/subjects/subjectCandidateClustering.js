const cosineSimilarityVector = require('../service-utils/cosineSimilarityVector');
const {
    getPendingSubjectCandidateFaces,
    getFacesForSubjectCandidateClustering,
    createSubjectCandidateCluster,
    updateSubjectCandidateCluster,
    deleteSubjectCandidateCluster,
    deleteSubjectCandidateClusterByFaceId,
    resetSubjectCandidateClusters,
} = require('./subjectsDbService');

const CANDIDATE_CLUSTER_MATCH_THRESHOLD = 0.5;

const findBestCandidateCluster = (embedding = [], candidateFaces = [], threshold = CANDIDATE_CLUSTER_MATCH_THRESHOLD) => {
    if (!Array.isArray(embedding) || embedding.length === 0) {
        return null;
    }

    let bestMatch = null;

    for (const candidateFace of candidateFaces) {
        if (!Array.isArray(candidateFace.embedding) || candidateFace.embedding.length === 0) {
            continue;
        }

        const score = cosineSimilarityVector(embedding, candidateFace.embedding);

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
                candidateId: candidateFace.candidateId,
                faceId: candidateFace.faceId,
                score,
            };
        }
    }

    if (!bestMatch || bestMatch.score < threshold) {
        return null;
    }

    return bestMatch;
};

/**
 * Creates a new subject candidate cluster for an unmatched extracted face.
 *
 * This is used when the face does not confidently match an already identified
 * subject or any existing pending candidate cluster.
 *
 * @param {{id: string, embedding?: Array<number>, confidence?: number}} face
 * @param {string} mediaType
 * @param {string} mediaId
 * @returns {object}
 */
const createCluster = (face, mediaType, mediaId) => {
    return createSubjectCandidateCluster(face.id, mediaType, mediaId);
};

/**
 * Assigns an extracted face to the best matching pending candidate cluster.
 *
 * If no pending candidate is similar enough, this creates a new cluster instead.
 * Known-subject matching should happen before this method is called.
 *
 * @param {{id: string, embedding?: Array<number>, confidence?: number}} face
 * @param {string} mediaType
 * @param {string} mediaId
 * @param {Array<{candidateId: number, faceId: string, embedding: Array<number>}>} [candidateFaces]
 * @param {number} [threshold]
 * @returns {object}
 */
const assignFaceToCandidateCluster = (
    face,
    mediaType,
    mediaId,
    candidateFaces = getPendingSubjectCandidateFaces(),
    threshold = CANDIDATE_CLUSTER_MATCH_THRESHOLD,
) => {
    const bestMatch = findBestCandidateCluster(face.embedding, candidateFaces, threshold);

    if (!bestMatch) {
        return createCluster(face, mediaType, mediaId);
    }

    return {
        ...updateSubjectCandidateCluster(bestMatch.candidateId, face.id, mediaType, mediaId),
        matchedFaceId: bestMatch.faceId,
        score: bestMatch.score,
    };
};

/**
 * Assigns a batch of extracted faces to pending candidate clusters.
 *
 * Prefer assigning each face immediately after it is persisted to the DB, so
 * clustering work is spread across extraction instead of deferred into one large
 * comparison pass. The candidate face cache is updated after each assignment so
 * faces processed earlier in the same batch can be matched by later faces without
 * reloading candidates from the database.
 *
 * @param {Array<{id: string, embedding?: Array<number>, confidence?: number}>} faces
 * @param {string} mediaType
 * @param {string} mediaId
 * @param {number} [threshold]
 * @returns {Array<object>}
 */
const assignFacesToCandidateClusters = (faces = [], mediaType, mediaId, threshold = CANDIDATE_CLUSTER_MATCH_THRESHOLD) => {
    const candidateFaces = getPendingSubjectCandidateFaces();
    const results = [];

    for (const face of faces) {
        const result = assignFaceToCandidateCluster(face, mediaType, mediaId, candidateFaces, threshold);
        results.push(result);

        candidateFaces.push({
            candidateId: result.candidateId,
            faceId: face.id,
            embedding: face.embedding,
            confidence: face.confidence,
        });
    }

    return results;
};

/**
 * Deletes an unresolved subject candidate cluster by candidate ID.
 *
 * Used after the cluster is promoted to a subject, rejected, ignored, or merged.
 * Face records are preserved; only candidate workspace links are removed.
 *
 * @param {number} candidateId
 * @returns {object}
 */
const deleteCluster = (candidateId) => {
    return deleteSubjectCandidateCluster(candidateId);
};

/**
 * Deletes the unresolved subject candidate cluster that contains a face.
 *
 * Convenience method for UI flows where the user action starts from a face
 * thumbnail instead of an explicit candidate ID.
 *
 * @param {string} faceId
 * @returns {object}
 */
const deleteClusterByFaceId = (faceId) => {
    return deleteSubjectCandidateClusterByFaceId(faceId);
};

/**
 * Clears all unresolved subject candidate clusters while preserving extracted face records.
 *
 * @returns {{deletedCandidateFaces: number, deletedImages: number, deletedVideos: number, deletedCandidates: number}}
 */
const resetCluster = () => {
    return resetSubjectCandidateClusters();
};

/**
 * Rebuilds all unresolved subject candidate clusters from already extracted faces.
 * This function is to be used for testing and finetune purpose. Not for production.
 *
 * This first resets current candidate clusters, then reassigns every unpromoted face using the
 * provided match threshold. Use this to test whether a lower threshold creates useful clusters.
 *
 * @param {number} [threshold]
 * @returns {{reset: object, threshold: number, processed: number, results: Array<object>}}
 */
const recreateClusters = (threshold = CANDIDATE_CLUSTER_MATCH_THRESHOLD) => {
    const reset = resetCluster();
    const faces = getFacesForSubjectCandidateClustering();
    const candidateFaces = [];
    const results = [];

    for (const face of faces) {
        const result = assignFaceToCandidateCluster(face, face.mediaType, face.mediaId, candidateFaces, threshold);
        results.push(result);

        candidateFaces.push({
            candidateId: result.candidateId,
            faceId: face.id,
            embedding: face.embedding,
            confidence: face.confidence,
        });
    }
    return {
        reset,
        threshold,
        processed: faces.length,
        results,
    };
};

const mergeClusters = (clusterList) => {
    // mergeThe face clusters.
};

const removeFaceFromCluster = (clusterId, faceId) => {};

module.exports = {
    createCluster,
    assignFaceToCandidateCluster,
    assignFacesToCandidateClusters,
    deleteCluster,
    deleteClusterByFaceId,
    resetCluster,
    recreateClusters,
};
