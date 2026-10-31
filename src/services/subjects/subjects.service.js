const { respondSuccess, respondError, respondFailure } = require('../service-utils/sendToUI');
const subjects = require('./subjects');
const {
    startBatchFaceProcessing,
    stopBatchFaceProcessing,
    getBatchFaceProcessingStatus,
    getPendingMediaForFaceExtraction,
} = require('./batchProcessForFaces');
const { extractFacesFromMedia } = require('./extractFacesFromMedia');
const { initializeDb, getSubjectCandidateClusters } = require('./subjectsDbService');

const {
    deleteFaceById,
    removeSubjectCandidateFromMedia,
    toggleRepresentativeFaceFromSubjectCandidate,
    identifySubject,
    identifySubjectByFaceId,
    updateSubjectName,
    deleteSubjectCandidate,
    mergeSubjectCandidates,
    splitSubjectCandidateCluster,
    getSubjectCandidatesForMedia,
} = subjects;

/**
 * Starts face extraction workflow.
 *
 * Uses the batch control exposed by
 * `src/services/subjects/batchProcessForFaces.js`.
 *
 * @returns {object}
 */
const startFaceExtractionService = async () => {
    try {
        const currentState = getBatchFaceProcessingStatus();

        if (currentState.status === 'processing' || currentState.status === 'stopping') {
            return respondFailure('Face extraction is already in progress.', currentState);
        }

        startBatchFaceProcessing();
        return respondSuccess('Face extraction started successfully.');
    } catch (error) {
        return respondError(`Failed to start face extraction: ${error.message}`);
    }
};

/**
 * Stops face extraction workflow.
 *
 * Uses the batch control exposed by
 * `src/services/subjects/batchProcessForFaces.js`.
 *
 * @returns {object}
 */
const stopFaceExtractionService = async () => {
    try {
        stopBatchFaceProcessing();
        return respondSuccess('Face extraction stopped.');
    } catch (error) {
        return respondError(`Failed to stop face extraction: ${error.message}`);
    }
};

/**
 * Processes queued subject candidates.
 *
 * Delegates to `subjects.js` when implementation exists.
 *
 * @returns {*}
 */
const processSubjectCandidatesService = async (...args) => {
    if (typeof processSubjectCandidates === 'function') {
        return processSubjectCandidates(...args);
    }
};

/**
 * Returns subject candidates for a given media item.
 *
 * Delegates to `subjects.js` when implementation exists.
 *
 * @param {*} mediaId
 * @returns {*}
 */
const getSubjectCandidatesForMediaService = async (mediaType, mediaId) => {
    if (typeof getSubjectCandidatesForMedia === 'function') {
        return getSubjectCandidatesForMedia(mediaType, mediaId);
    }
};

/**
 * Discards user-ignored faces from subject candidates.
 *
 * Delegates to `subjects.js` when implementation exists.
 *
 * @returns {*}
 */
const discardFacesService = async (...args) => {
    if (typeof discardFaces === 'function') {
        return discardFaces(...args);
    }
};

/**
 * Identifies a subject candidate with a user-provided name.
 *
 * Delegates to `subjects.js` when implementation exists.
 *
 * @param {*} subjectCandidate
 * @param {*} name
 * @returns {*}
 */
const identifySubjectService = async (candidateId, name, existingSubjectId) => {
    try {
        const result = identifySubject(candidateId, name, existingSubjectId);
        return respondSuccess('Subject candidate identified successfully.', result);
    } catch (error) {
        return respondError(`Failed to identify subject candidate ${candidateId}: ${error.message}`);
    }
};

const identifySubjectByFaceIdService = async (faceId, name, existingSubjectId) => {
    try {
        const result = identifySubjectByFaceId(faceId, name, existingSubjectId);
        return respondSuccess('Subject candidate identified successfully.', result);
    } catch (error) {
        return respondError(`Failed to identify subject candidate by face ${faceId}: ${error.message}`);
    }
};

const updateSubjectNameService = async (subjectId, name) => {
    try {
        const result = updateSubjectName(subjectId, name);

        if (!result.updated) {
            return respondFailure('Subject was not found.', result);
        }

        return respondSuccess('Subject name updated successfully.', result);
    } catch (error) {
        return respondError(`Failed to update subject ${subjectId}: ${error.message}`);
    }
};

/**
 * Removes a face association from a subject.
 *
 * Delegates to `subjects.js` when implementation exists.
 *
 * @returns {*}
 */
const removeFaceIdFromSubjectService = async (...args) => {
    if (typeof removeFaceIdFromSubject === 'function') {
        return removeFaceIdFromSubject(...args);
    }
};

/**
 * Deletes a subject.
 *
 * Delegates to `subjects.js` when implementation exists.
 *
 * @returns {*}
 */
const deleteSubjectService = async (...args) => {
    if (typeof deleteSubject === 'function') {
        return deleteSubject(...args);
    }
};

/**
 * Deletes one or more subject candidates.
 *
 * Delegates to `subjects.js` when implementation exists.
 *
 * @returns {*}
 */
const deleteSubjectCandidatesService = async (...args) => {
    if (typeof deleteSubjectCandidates === 'function') {
        return deleteSubjectCandidates(...args);
    }
};

/**
 * Re-extracts faces for a single media item, regardless of whether faces
 * have already been extracted for it.
 *
 * @param {string} mediaId   - ID of the video or image to process.
 * @param {string} mediaType - mediaTypes.VIDEO or mediaTypes.IMAGE.
 * @returns {object} respondSuccess with face count, or respondError on failure.
 */
const extractFacesFromMediaService = async (mediaId, mediaType) => {
    try {
        const result = await extractFacesFromMedia(mediaId, mediaType);
        return respondSuccess(`Face extraction complete. ${result.faceCount} face(s) found.`, {
            mediaId,
            mediaType,
            faceCount: result.faceCount,
        });
    } catch (error) {
        return respondError(`Face extraction failed for ${mediaId}: ${error.message}`);
    }
};

const getSubjectsByMediaService = async (mediaType, mediaId) => {
    try {
        const subjectsForMedia = getSubjectCandidatesForMedia(mediaType, mediaId);
        return respondSuccess('Subjects fetched successfully.', subjectsForMedia);
    } catch (error) {
        return respondError(`Failed to fetch subjects for media ${mediaId}: ${error.message}`);
    }
};

const getSubjectCandidateClustersService = async (candidateType) => {
    try {
        return respondSuccess('Subject candidate clusters fetched successfully.', getSubjectCandidateClusters(candidateType));
    } catch (error) {
        return respondError(`Failed to fetch subject candidate clusters: ${error.message}`);
    }
};

const getPendingFaceExtractionCountService = async () => {
    try {
        const pendingMedia = getPendingMediaForFaceExtraction();

        return respondSuccess('Pending face extraction count fetched successfully.', {
            count: pendingMedia.length,
        });
    } catch (error) {
        return respondError(`Failed to fetch pending face extraction count: ${error.message}`);
    }
};

const deleteFaceService = async (faceId) => {
    try {
        const result = await deleteFaceById(faceId);

        if (!result.deleted) {
            return respondFailure('Face was not found.', result);
        }

        return respondSuccess('Face deleted successfully.', result);
    } catch (error) {
        return respondError(`Failed to delete face ${faceId}: ${error.message}`);
    }
};

const deleteSubjectCandidateClusterService = async (candidateIds) => {
    try {
        const result = await deleteSubjectCandidate(candidateIds);

        if (!result.deleted) {
            return respondFailure('Subject candidate cluster was not found.', result);
        }

        return respondSuccess('Subject candidate cluster deleted successfully.', result);
    } catch (error) {
        return respondError(`Failed to delete subject candidate cluster: ${error.message}`);
    }
};

const toggleRepresentativeFaceFromSubjectCandidateService = async (candidateId, faceId, isRepresentative) => {
    try {
        const result = toggleRepresentativeFaceFromSubjectCandidate(candidateId, faceId, isRepresentative);

        if (!result.updated) {
            return respondFailure('Representative face was not found for this candidate.', result);
        }

        return respondSuccess('Representative face removed from candidate successfully.', result);
    } catch (error) {
        return respondError(`Failed to remove representative face ${faceId}: ${error.message}`);
    }
};

const removeSubjectCandidateFromMediaService = async (mediaType, mediaId, subjectCandidateId, selectedFaceId) => {
    try {
        const result = await removeSubjectCandidateFromMedia(mediaType, mediaId, subjectCandidateId, selectedFaceId);

        if (!result.removed) {
            return respondFailure('Subject candidate was not removed from media.', result);
        }

        return respondSuccess('Subject candidate removed from media successfully.', result);
    } catch (error) {
        return respondError(`Failed to remove subject candidate ${subjectCandidateId} from media ${mediaId}: ${error.message}`);
    }
};

const mergeSubjectCandidateClustersService = async (subjectCandidates) => {
    try {
        const result = mergeSubjectCandidates(subjectCandidates);
        return respondSuccess('Subject candidate clusters merged successfully.', result);
    } catch (error) {
        return respondError(`Failed to merge subject candidate clusters: ${error.message}`);
    }
};

const splitSubjectCandidateClusterService = async (candidateId, faceIds) => {
    try {
        const result = splitSubjectCandidateCluster(candidateId, faceIds);
        return respondSuccess('Subject candidate cluster split successfully.', result);
    } catch (error) {
        return respondError(`Failed to split subject candidate cluster ${candidateId}: ${error.message}`);
    }
};

const initSubjectsService = () => {
    initializeDb();
};

module.exports = {
    initSubjectsService,
    startFaceExtractionService,
    stopFaceExtractionService,
    processSubjectCandidatesService,
    getSubjectCandidatesForMediaService,
    discardFacesService,
    identifySubjectService,
    identifySubjectByFaceIdService,
    updateSubjectNameService,
    removeFaceIdFromSubjectService,
    deleteSubjectService,
    deleteSubjectCandidatesService,
    extractFacesFromMediaService,
    getSubjectsByMediaService,
    getSubjectCandidateClustersService,
    getPendingFaceExtractionCountService,
    deleteFaceService,
    deleteSubjectCandidateClusterService,
    toggleRepresentativeFaceFromSubjectCandidateService,
    removeSubjectCandidateFromMediaService,
    mergeSubjectCandidateClustersService,
    splitSubjectCandidateClusterService,
};
