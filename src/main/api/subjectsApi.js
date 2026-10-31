const serviceMethods = require('../../constants/serviceMethods');

const subjectsApi = (ipcRenderer) => ({
    // Face extraction
    startFaceExtraction: () => ipcRenderer.invoke(serviceMethods.SUBJECTS_START_FACE_EXTRACTION),
    stopFaceExtraction: () => ipcRenderer.invoke(serviceMethods.SUBJECTS_STOP_FACE_EXTRACTION),
    getPendingFaceExtractionCount: () => ipcRenderer.invoke(serviceMethods.SUBJECTS_GET_PENDING_FACE_EXTRACTION_COUNT),
    extractFacesFromMedia: (mediaId, mediaType) => ipcRenderer.invoke(serviceMethods.SUBJECTS_EXTRACT_FACES_FROM_MEDIA, mediaId, mediaType),
    // Face management : delete operations
    deleteFace: (faceId) => ipcRenderer.invoke(serviceMethods.SUBJECTS_DELETE_FACE, faceId),
    deleteSubjectCandidateCluster: (candidateIds) => ipcRenderer.invoke(serviceMethods.SUBJECTS_DELETE_CANDIDATE_CLUSTER, candidateIds),
    removeSubjectCandidateFromMedia: (mediaType, mediaId, subjectCandidateId, selectedFaceId) =>
        ipcRenderer.invoke(serviceMethods.SUBJECTS_REMOVE_CANDIDATE_FROM_MEDIA, mediaType, mediaId, subjectCandidateId, selectedFaceId),
    toggleRepresentativeFaceFromSubjectCandidate: (candidateId, faceId, isRepresentative) =>
        ipcRenderer.invoke(serviceMethods.SUBJECTS_TOGGLE_REPRESENTATIVE_FACE_FROM_CANDIDATE, candidateId, faceId, isRepresentative),

    // subject candiate cluster management
    mergeSubjectCandidateClusters: (subjectCandidates) =>
        ipcRenderer.invoke(serviceMethods.SUBJECTS_MERGE_CANDIDATE_CLUSTERS, subjectCandidates),
    splitSubjectCandidateCluster: (candidateId, faceIds) =>
        ipcRenderer.invoke(serviceMethods.SUBJECTS_SPLIT_CANDIDATE_CLUSTER, candidateId, faceIds),

    // subjects and clusters get ops
    getSubjectsByMedia: (mediaType, mediaId) => ipcRenderer.invoke(serviceMethods.SUBJECTS_GET_BY_MEDIA, mediaType, mediaId),
    getSubjectCandidateClusters: (candidateType) => ipcRenderer.invoke(serviceMethods.SUBJECTS_GET_CANDIDATE_CLUSTERS, candidateType),

    // subject identification and name updates
    identifySubjectCandidate: (candidateId, name, existingSubjectId) =>
        ipcRenderer.invoke(serviceMethods.SUBJECTS_IDENTIFY_CANDIDATE, candidateId, name, existingSubjectId),
    identifySubjectCandidateByFace: (faceId, name, existingSubjectId) =>
        ipcRenderer.invoke(serviceMethods.SUBJECTS_IDENTIFY_CANDIDATE_BY_FACE, faceId, name, existingSubjectId),
    updateSubjectName: (subjectId, name) => ipcRenderer.invoke(serviceMethods.SUBJECTS_UPDATE_SUBJECT_NAME, subjectId, name),
});

module.exports = {
    subjectsApi,
};
