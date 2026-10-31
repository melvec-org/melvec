const path = require('path');
const {
    getFacesByMediaId,
    deleteFace,
    createSubject,
    updateSubject,
    identifySubjectCandidate,
    getSubjectCandidateIdByFaceId,
    getSubjectCandidateFaceIds,
    getSubjectCandidateFaces,
    getSubjectCandidateMediaIds,
    updateSubjectCandidateFaceRepresentatives,
    deleteSubjectCandidateCluster,
    removeMediaFromSubjectCandidate,
    mergeSubjectCandidateClusters,
    splitSubjectCandidateCluster,
    getSubjectsCandiatesByMediaId,
} = require('./subjectsDbService');
const { getFacesPath } = require('../servicePathConfig');
const { removeFile } = require('../service-utils/fileUtils');

//const getSubjectsById = (mediaType, mediaId) => {};
const getSubjectCandidatesByMediaId = (mediaType, mediaId) => {};

const getSubjectCandidatesForMedia = (mediaType, mediaId) => {
    // now push all faces as subject identification is not done.
    // const subjects = getSubjectsByMediaId();

    const subjects = getSubjectsCandiatesByMediaId(mediaType, mediaId);

    return subjects.map((item) => {
        return {
            id: item.id,
            status: item.status,
            face: item.faces[0],
            name: item.name,
        };
    });
};

/**
 * Permanently deletes a retained face crop and its candidate-face association.
 *
 * This is for the user action: "I do not want to keep this face at all." Candidate-media
 * associations are intentionally preserved so the media can remain attached to the subject
 * candidate even after the face evidence is deleted.
 *
 * @param {string} faceId Face ID to permanently delete.
 * @returns {Promise<object>} DB deletion result.
 */
const deleteFaceById = async (faceId) => {
    const faceThumbnailPath = path.join(getFacesPath(), `${faceId}.jpg`);

    await removeFile(faceThumbnailPath);

    return deleteFace(faceId);
};

/**
 * Removes a subject candidate from a specific media item.
 *
 * This is for the user action: "This subject should not be associated with this media."
 * The candidate-media relationship is the user-visible source of truth, while retained
 * face crops are reusable identity evidence for future matching and representative display.
 *
 * Removal rules:
 * - If the candidate is associated only with this media, delete the whole candidate cluster
 *   and its retained face records/thumbnails.
 * - If the candidate is associated with multiple media items, remove only this media link.
 * - In the multi-media case, also delete the selected face only when it was extracted from
 *   this same media and is not marked as a representative face.
 * - Preserve representative faces and faces extracted from other media, because they may be
 *   used as the candidate's best display image or for future matching.
 *
 * @param {string} mediaType Media type for the relationship to remove, such as image or video.
 * @param {string} mediaId Media ID to disassociate from the subject candidate.
 * @param {number|string} subjectCandidateId Subject candidate cluster ID.
 * @param {string} [selectedFaceId] Optional face ID currently shown/selected in the UI.
 * @returns {Promise<object>} Removal summary, including media-link removal and any deleted face/candidate details.
 * @throws {Error} If the subject candidate ID or media type is invalid.
 */
const removeSubjectCandidateFromMedia = async (mediaType, mediaId, subjectCandidateId, selectedFaceId) => {
    const candidateId = Number(subjectCandidateId);

    if (!Number.isInteger(candidateId)) {
        throw new Error('Subject candidate id must be a valid integer');
    }

    const candidateMedia = getSubjectCandidateMediaIds(candidateId);
    const isAssociatedWithMedia = candidateMedia.some((item) => item.mediaType === mediaType && item.mediaId === mediaId);

    if (!isAssociatedWithMedia) {
        return {
            candidateId,
            mediaType,
            mediaId,
            removed: false,
            reason: 'MEDIA_NOT_ASSOCIATED_WITH_CANDIDATE',
        };
    }

    const faceIds = getSubjectCandidateFaceIds(candidateId);
    const hasSingleMedia = candidateMedia.length === 1;
    const hasSingleFace = faceIds.length === 1;

    // single media case
    if (hasSingleMedia && hasSingleFace) {
        const [faceId] = faceIds;

        await removeFile(path.join(getFacesPath(), `${faceId}.jpg`));

        return {
            candidateId,
            mediaType,
            mediaId,
            removed: true,
            useCase: 'SINGLE_MEDIA_SINGLE_FACE',
            deletedFaceIds: [faceId],
            selectedFaceId,
            ...deleteSubjectCandidateCluster(candidateId, { deleteFaces: true }),
        };
    }

    // multiple media use case
    if (!hasSingleMedia) {
        const candidateFaces = getSubjectCandidateFaces(candidateId);
        const selectedFace = selectedFaceId ? candidateFaces.find((face) => face.faceId === selectedFaceId) : null;
        const shouldDeleteSelectedFace = Boolean(selectedFace && selectedFace.mediaId === mediaId && !selectedFace.isRepresentative);
        const deletedFaceIds = [];

        if (shouldDeleteSelectedFace) {
            await removeFile(path.join(getFacesPath(), `${selectedFace.faceId}.jpg`));
            deleteFace(selectedFace.faceId);
            deletedFaceIds.push(selectedFace.faceId);
        }

        const mediaRemoval = removeMediaFromSubjectCandidate(candidateId, mediaType, mediaId);

        return {
            candidateId,
            mediaType,
            mediaId,
            removed: mediaRemoval.removed,
            useCase: 'MULTIPLE_MEDIA',
            selectedFaceId,
            deletedFaceIds,
            preservedFaceIds: candidateFaces.map((face) => face.faceId).filter((faceId) => !deletedFaceIds.includes(faceId)),
        };
    }

    return {
        candidateId,
        mediaType,
        mediaId,
        removed: false,
        useCase: 'SINGLE_MEDIA_MULTIPLE_FACES',
        reason: 'SINGLE_MEDIA_MULTIPLE_FACES_REMOVAL_NOT_IMPLEMENTED',
    };
};

/**
 * Removes a face from the representative set while keeping it as candidate evidence.
 *
 * This is for the user action: "I do not want this as a representative face." The face
 * record, thumbnail, candidate-face link, and candidate-media links are preserved.
 *
 * @param {number|string} candidateId Subject candidate cluster ID.
 * @param {string} faceId Face ID to demote from representative usage.
 * @returns {object} Update result.
 */
const toggleRepresentativeFaceFromSubjectCandidate = (candidateId, faceId, isRepresentative) => {
    const normalizedCandidateId = Number(candidateId);

    if (!Number.isInteger(normalizedCandidateId)) {
        throw new Error('Subject candidate id must be a valid integer');
    }

    return updateSubjectCandidateFaceRepresentatives(normalizedCandidateId, [
        {
            faceId,
            isRepresentative: isRepresentative,
            representativeRank: null,
        },
    ]);
};

/**
 * Identifies a subject candidate cluster as a subject.
 *
 * Candidate clusters are permanent evidence records. Identification does not copy
 * candidate media into separate subject-media tables and does not delete the candidate.
 * It simply links the candidate to a subject and marks it as identified. Subject media
 * is derived through identified candidates and their candidate-media associations.
 *
 * Expected flow:
 * 1. Use an existing subject ID when provided, otherwise create a new subject using `name`.
 * 2. Mark the candidate cluster as identified.
 * 3. Store the subject association on `subjects_candidates.subject_id`.
 *
 * @param {number|string} clusterId Subject candidate cluster ID to identify.
 * @param {string} name User-provided subject name. Required when `existingSubjectId` is not provided.
 * @param {number|string} [existingSubjectId] Optional existing subject ID.
 * @returns {{candidateId: number, subjectId: number, status: string, updated: boolean, subject?: object}}
 */
const identifySubject = (clusterId, name, existingSubjectId) => {
    const candidateId = Number(clusterId);

    if (!Number.isInteger(candidateId)) {
        throw new Error('Subject candidate cluster id must be a valid integer');
    }

    const subjectId = existingSubjectId ? Number(existingSubjectId) : null;

    if (subjectId !== null && !Number.isInteger(subjectId)) {
        throw new Error('Existing subject id must be a valid integer');
    }

    const subject = subjectId ? null : createSubject(name);
    const resolvedSubjectId = subjectId || subject.id;

    return {
        ...identifySubjectCandidate(candidateId, resolvedSubjectId),
        subject,
    };
};

/**
 * Identifies the subject candidate cluster that contains a selected face.
 *
 * This is intended for single-media detail flows where the UI presents retained faces
 * for the current media. Naming a face identifies the candidate cluster that owns that
 * face; the media association remains on the candidate-media tables.
 *
 * @param {string} faceId Face ID selected from a media detail view.
 * @param {string} name User-provided subject name. Required when `existingSubjectId` is not provided.
 * @param {number|string} [existingSubjectId] Optional existing subject ID.
 * @returns {{candidateId: number, subjectId: number, status: string, updated: boolean, subject?: object}}
 */
const identifySubjectByFaceId = (faceId, name, existingSubjectId) => {
    const candidateId = getSubjectCandidateIdByFaceId(faceId);

    if (!Number.isInteger(candidateId)) {
        throw new Error('Face is not associated with a subject candidate');
    }

    return identifySubject(candidateId, name, existingSubjectId);
};

/**
 * Updates the display name of an existing subject.
 *
 * Names are not globally unique; this only changes the label for the provided subject ID.
 *
 * @param {number|string} subjectId Subject ID to rename.
 * @param {string} name New subject name.
 * @returns {{id: number, name: string, updated: boolean}}
 */
const updateSubjectName = (subjectId, name) => {
    const normalizedSubjectId = Number(subjectId);

    if (!Number.isInteger(normalizedSubjectId)) {
        throw new Error('Subject id must be a valid integer');
    }

    return updateSubject(normalizedSubjectId, name);
};

/**
 * Permanently deletes one or more subject candidate clusters and their retained face evidence.
 *
 * This is for destructive user flows such as rejecting/removing candidate clusters.
 * It removes physical face thumbnails, face records, candidate-face links, candidate-media
 * links, and candidate rows.
 *
 * @param {Array<number|string>} candidateIds Subject candidate cluster IDs selected for deletion.
 * @returns {Promise<object>} Deletion result including deleted candidate rows and face IDs.
 */
const deleteSubjectCandidate = (candidateIds = []) => {
    if (!Array.isArray(candidateIds)) {
        throw new Error('candidateIds must be an array');
    }

    const normalizedCandidateIds = [...new Set(candidateIds.map((candidateId) => Number(candidateId)).filter(Number.isInteger))];

    if (normalizedCandidateIds.length === 0) {
        throw new Error('At least one subject candidate id is required');
    }

    const faceIds = [...new Set(normalizedCandidateIds.flatMap((candidateId) => getSubjectCandidateFaceIds(candidateId)))];

    return Promise.all(faceIds.map((faceId) => removeFile(path.join(getFacesPath(), `${faceId}.jpg`)))).then(() => {
        const results = normalizedCandidateIds.map((candidateId) => deleteSubjectCandidateCluster(candidateId, { deleteFaces: true }));

        return {
            candidateIds: normalizedCandidateIds,
            deleted: results.some((result) => result.deleted),
            deletedCandidates: results.filter((result) => result.deleted).length,
            deletedFaces: results.reduce((total, result) => total + result.deletedFaces, 0),
            deletedImages: results.reduce((total, result) => total + result.deletedImages, 0),
            deletedVideos: results.reduce((total, result) => total + result.deletedVideos, 0),
            deletedFaceRecords: results.reduce((total, result) => total + result.deletedFaceRecords, 0),
            faceIds,
            results,
        };
    });
};

/**
 * Merges multiple subject candidate clusters after applying domain-level merge rules.
 *
 * Rules:
 * - At least two candidates are required.
 * - If exactly one selected candidate is identified, it becomes the merge target.
 * - If no selected candidate is identified, the first selected candidate becomes the target.
 * - If more than one selected candidate is identified, the merge is refused because
 *   that would merge two subjects.
 *
 * The DB layer performs the actual link movement and source candidate deletion.
 *
 * @param {Array<{id: number|string, status?: 'pending'|'identified'}|number|string>} subjectCandidates
 * Selected candidate IDs or candidate objects in user-selected order.
 * @returns {object} Merge summary from the DB layer.
 * @throws {Error} When fewer than two candidates are provided or more than one selected
 * candidate has `status === 'identified'`.
 */
const mergeSubjectCandidates = (subjectCandidates = []) => {
    if (!Array.isArray(subjectCandidates)) {
        throw new Error('subjectCandidates must be an array');
    }

    const candidateIds = [
        ...new Set(
            subjectCandidates
                .map((candidate) => {
                    if (Number.isInteger(candidate)) {
                        return candidate;
                    }

                    if (typeof candidate === 'string' && candidate.trim() !== '') {
                        return Number(candidate);
                    }

                    return Number(candidate?.id);
                })
                .filter(Number.isInteger),
        ),
    ];

    if (candidateIds.length < 2) {
        throw new Error('At least two subject candidates are required to merge');
    }

    const identifiedCandidateCount = subjectCandidates.filter((candidate) => candidate?.status === 'identified').length;

    if (identifiedCandidateCount > 1) {
        throw new Error('Cannot merge more than one identified subject candidate');
    }

    return mergeSubjectCandidateClusters(candidateIds);
};

module.exports = {
    getSubjectCandidatesByMediaId,

    deleteFaceById,
    toggleRepresentativeFaceFromSubjectCandidate,
    identifySubject,
    identifySubjectByFaceId,
    updateSubjectName,
    deleteSubjectCandidate,
    mergeSubjectCandidates,
    splitSubjectCandidateCluster,
    getSubjectCandidatesForMedia,
    removeSubjectCandidateFromMedia,
};
