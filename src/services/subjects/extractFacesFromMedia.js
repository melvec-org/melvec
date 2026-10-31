const path = require('path');

const { extractFaces } = require('../service-utils/extractFaces');
const { removeFile } = require('../service-utils/fileUtils');
const {
    addFace,
    getFacesByMediaId,
    deleteFace,
    getSubjectCandidateIdByFaceId,
    getSubjectCandidateMediaIds,
    deleteSubjectCandidateCluster,
    removeMediaFromSubjectCandidate,
    getPendingSubjectCandidateFaces,
} = require('./subjectsDbService');
const { assignFaceToCandidateCluster } = require('./subjectCandidateClustering');
const {
    getVideoDetailsById,
    updateFaceExtractionStatus: updateVideoFaceExtractionStatus,
} = require('../video-library/videoLibraryDbService');
const {
    getImageDetailsById,
    updateFaceExtractionStatus: updateImageFaceExtractionStatus,
} = require('../image-library/imageLibraryDbService');
const { getLibDir } = require('../servicePathConfig');
const mediaTypes = require('../../constants/mediaTypes');
const faceExtractionStatus = require('../../constants/faceExtractionStatus');

const updateMediaFaceExtractionStatus = (mediaType, mediaId, status) => {
    if (mediaType === mediaTypes.VIDEO) {
        return updateVideoFaceExtractionStatus(mediaId, status);
    }

    if (mediaType === mediaTypes.IMAGE) {
        return updateImageFaceExtractionStatus(mediaId, status);
    }

    throw new Error(`Unsupported media type for face extraction: ${mediaType}`);
};

const removeExistingFacesForMedia = async (mediaType, mediaId) => {
    const existingFaces = getFacesByMediaId(mediaId, true);
    const cleanedCandidateIds = new Set();

    for (const face of existingFaces) {
        const candidateId = getSubjectCandidateIdByFaceId(face.id);

        if (candidateId && !cleanedCandidateIds.has(candidateId)) {
            const candidateMedia = getSubjectCandidateMediaIds(candidateId);
            const isOnlyLinkedToThisMedia =
                candidateMedia.length === 1 && candidateMedia[0].mediaType === mediaType && candidateMedia[0].mediaId === mediaId;

            if (isOnlyLinkedToThisMedia) {
                deleteSubjectCandidateCluster(candidateId);
            } else {
                removeMediaFromSubjectCandidate(candidateId, mediaType, mediaId);
            }

            cleanedCandidateIds.add(candidateId);
        }

        await removeFile(face.imagePath).catch(() => {});
        deleteFace(face.id);
    }
};

/**
 * Re-extracts faces for a single media item, regardless of whether faces
 * have already been extracted for it.
 *
 * Steps:
 *   1. Fetch media details and resolve the absolute path.
 *   2. Remove existing face files and stale subject-candidate/media links for this media.
 *   3. Re-run face extraction with relaxed thresholds.
 *   4. Persist the new faces to the DB (path not stored — derived at read time).
 *   5. Update media face extraction status from the native detection result.
 *
 * @param {string} mediaId   - ID of the video or image to process.
 * @param {string} mediaType - mediaTypes.VIDEO or mediaTypes.IMAGE.
 * @returns {Promise<{faceCount: number, detectedFaceCount: number, selectedFaceCount: number, status: string, faces: Array}>}
 * @throws {Error} If media is not found or extraction fails.
 */
const extractFacesFromMedia = async (mediaId, mediaType) => {
    // 1. Resolve media path.
    const mediaDetails = mediaType === mediaTypes.VIDEO ? getVideoDetailsById(mediaId) : getImageDetailsById(mediaId);

    if (!mediaDetails?.path) {
        throw new Error(`Media not found or path unavailable: ${mediaId}`);
    }

    const mediaPath = path.join(getLibDir(), mediaDetails.path);

    // 2. Remove existing face files and stale subject-candidate links before re-extracting.
    await removeExistingFacesForMedia(mediaType, mediaId);

    // 3. Re-extract faces with relaxed thresholds for manual retry.
    const faceData = await extractFaces(mediaPath, mediaType, mediaId, { relaxed: true });

    const status =
        faceData.detectedFaceCount > 0
            ? faceExtractionStatus.COMPLETED_FACE_DETECTED
            : faceExtractionStatus.COMPLETED_NO_FACE_DETECTED;

    // 4. Persist new faces — path is NOT stored, derived at read time as ._fc_/<faceId>.jpg.
    const candidateFaces = getPendingSubjectCandidateFaces();
    for (const face of faceData.faces || []) {
        addFace(face.mediaId, mediaId, face.confidence, face.embedding);

        const result = assignFaceToCandidateCluster(
            { id: face.mediaId, embedding: face.embedding, confidence: face.confidence },
            mediaType,
            mediaId,
            candidateFaces,
        );
        candidateFaces.push({
            candidateId: result.candidateId,
            faceId: face.mediaId,
            embedding: face.embedding,
            confidence: face.confidence,
        });
    }

    // 5. Persist the media-level extraction result.
    updateMediaFaceExtractionStatus(mediaType, mediaId, status);

    return {
        faceCount: faceData.faces?.length ?? 0,
        detectedFaceCount: faceData.detectedFaceCount ?? 0,
        selectedFaceCount: faceData.selectedFaceCount ?? 0,
        status,
        faces: faceData.faces ?? [],
    };
};

module.exports = {
    extractFacesFromMedia,
};
