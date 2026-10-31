const serviceMethods = require('../../../constants/serviceMethods');
const { validateSubjectCandidateType } = require('../../service-utils/ipcValidation');

const getSubjectCandidateClustersHandler = async (candidateType) => {
    const validationError = validateSubjectCandidateType(candidateType);
    if (validationError) {
        return validationError;
    }

    return getSubjectCandidateClustersService(candidateType);
};

const {
    startFaceExtractionService,
    stopFaceExtractionService,
    getPendingFaceExtractionCountService,
    extractFacesFromMediaService,
    deleteFaceService,
    deleteSubjectCandidateClusterService,
    removeSubjectCandidateFromMediaService,
    toggleRepresentativeFaceFromSubjectCandidateService,
    mergeSubjectCandidateClustersService,
    splitSubjectCandidateClusterService,
    identifySubjectService,
    identifySubjectByFaceIdService,
    updateSubjectNameService,
    getSubjectsByMediaService,
    getSubjectCandidateClustersService,
} = require('../../subjects/subjects.service');

const subjectsServiceHandlers = [
    [serviceMethods.SUBJECTS_START_FACE_EXTRACTION, async () => startFaceExtractionService()],
    [serviceMethods.SUBJECTS_STOP_FACE_EXTRACTION, async () => stopFaceExtractionService()],
    [serviceMethods.SUBJECTS_GET_PENDING_FACE_EXTRACTION_COUNT, async () => getPendingFaceExtractionCountService()],
    [serviceMethods.SUBJECTS_EXTRACT_FACES_FROM_MEDIA, async (mediaId, mediaType) => extractFacesFromMediaService(mediaId, mediaType)],
    [serviceMethods.SUBJECTS_DELETE_FACE, async (faceId) => deleteFaceService(faceId)],
    [serviceMethods.SUBJECTS_DELETE_CANDIDATE_CLUSTER, async (candidateIds) => deleteSubjectCandidateClusterService(candidateIds)],
    [
        serviceMethods.SUBJECTS_REMOVE_CANDIDATE_FROM_MEDIA,
        async (mediaType, mediaId, subjectCandidateId, selectedFaceId) =>
            removeSubjectCandidateFromMediaService(mediaType, mediaId, subjectCandidateId, selectedFaceId),
    ],
    [
        serviceMethods.SUBJECTS_TOGGLE_REPRESENTATIVE_FACE_FROM_CANDIDATE,
        async (candidateId, faceId, isRepresentative) =>
            toggleRepresentativeFaceFromSubjectCandidateService(candidateId, faceId, isRepresentative),
    ],
    [
        serviceMethods.SUBJECTS_MERGE_CANDIDATE_CLUSTERS,
        async (subjectCandidates) => mergeSubjectCandidateClustersService(subjectCandidates),
    ],
    [
        serviceMethods.SUBJECTS_SPLIT_CANDIDATE_CLUSTER,
        async (candidateId, faceIds) => splitSubjectCandidateClusterService(candidateId, faceIds),
    ],
    [
        serviceMethods.SUBJECTS_IDENTIFY_CANDIDATE,
        async (candidateId, name, existingSubjectId) => identifySubjectService(candidateId, name, existingSubjectId),
    ],
    [
        serviceMethods.SUBJECTS_IDENTIFY_CANDIDATE_BY_FACE,
        async (faceId, name, existingSubjectId) => identifySubjectByFaceIdService(faceId, name, existingSubjectId),
    ],
    [serviceMethods.SUBJECTS_UPDATE_SUBJECT_NAME, async (subjectId, name) => updateSubjectNameService(subjectId, name)],
    [serviceMethods.SUBJECTS_GET_BY_MEDIA, async (mediaType, mediaId) => getSubjectsByMediaService(mediaType, mediaId)],
    [serviceMethods.SUBJECTS_GET_CANDIDATE_CLUSTERS, getSubjectCandidateClustersHandler],
];

module.exports = {
    subjectsServiceHandlers,
};
