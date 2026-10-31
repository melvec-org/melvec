import responseStatus from '__constants/responseStatus';
import { useEffect, useState } from 'react';
import { SUBJECT_NAME_ALLOWED_REGX, SUBJECT_NAME_VALID_REGX } from '../../../../configs/constraints';
import { showGlobalNotification } from '__contexts/AppNotificationContext';

const isValidSubjectName = (name = '') => SUBJECT_NAME_VALID_REGX.test(name.trim());

const useSubjectCandidateReview = () => {
    const [subjectCandidateList, setSubjectCandidateList] = useState([]);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [candidateName, setCandidateName] = useState('');
    const [candidateFilter, setCandidateFilter] = useState('pending');
    const [knownFacesSearchText, setKnownFacesSearchText] = useState('');
    const [isMultiEditEnabled, setIsMultiEditEnabled] = useState(false);
    const [clustersToEdit, setClustersToEdit] = useState([]);

    const normalizedKnownFacesSearchText = knownFacesSearchText.trim().toLowerCase();
    const visibleCandidateList =
        candidateFilter === 'identified' && normalizedKnownFacesSearchText
            ? subjectCandidateList.filter((candidate) => (candidate.name || '').toLowerCase().includes(normalizedKnownFacesSearchText))
            : subjectCandidateList;
    const isCandidateNameValid = isValidSubjectName(candidateName);
    const isCandidateNameChanged = candidateName.trim() !== (selectedCandidate?.name || '').trim();

    const toggleMultiEdit = (isEnabled) => {
        setIsMultiEditEnabled(isEnabled);

        if (!isEnabled) {
            setClustersToEdit([]);
        }
    };

    const fetchSubjectCandidateClusters = (candidateType = candidateFilter) => {
        window.api.getSubjectCandidateClusters(candidateType).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setSubjectCandidateList(response.data || []);
                setClustersToEdit([]);
            } else {
                alert(response.message);
                setSubjectCandidateList([]);
                setClustersToEdit([]);
            }
        });
    };

    const updateCandidateFilter = (candidateType) => {
        setCandidateFilter(candidateType);
        setKnownFacesSearchText('');
        fetchSubjectCandidateClusters(candidateType);
    };

    const openCandidateModal = (candidate) => {
        setSelectedCandidate(candidate);
        setCandidateName(candidate.name || '');
    };

    const closeCandidateModal = () => {
        setSelectedCandidate(null);
        setCandidateName('');
    };

    const updateCandidateName = (name = '') => {
        if (!SUBJECT_NAME_ALLOWED_REGX.test(name)) {
            return;
        }

        setCandidateName(name);
    };

    const isCandidateSelectedForEdit = (candidateId) => clustersToEdit.some((candidate) => candidate.id === candidateId);

    const toggleCandidateForEdit = (candidate) => {
        if (!candidate?.id) {
            return;
        }

        setClustersToEdit((currentClusters) => {
            if (currentClusters.some((item) => item.id === candidate.id)) {
                return currentClusters.filter((item) => item.id !== candidate.id);
            }

            return [...currentClusters, candidate];
        });
    };

    const removeFaceFromSubject = (faceId) => {
        if (!faceId) {
            return;
        }

        if ((selectedCandidate?.faces || []).length <= 1) {
            alert('Cannot remove the only face from a subject candidate. Delete the subject candidate instead.');
            return;
        }

        if (!window.confirm('Are you sure you want to remove this face?')) {
            return;
        }

        window.api.deleteFace(faceId).then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }

            setSubjectCandidateList((currentList) =>
                currentList
                    .map((candidate) => {
                        const faces = (candidate.faces || []).filter((face) => face.id !== faceId);

                        return {
                            ...candidate,
                            faces,
                            faceCount: faces.length,
                        };
                    })
                    .filter((candidate) => candidate.faces.length > 0),
            );

            setClustersToEdit([]);

            setSelectedCandidate((currentCandidate) => {
                if (!currentCandidate) {
                    return currentCandidate;
                }

                const faces = (currentCandidate.faces || []).filter((face) => face.id !== faceId);

                if (faces.length === 0) {
                    setCandidateName('');
                    return null;
                }

                return {
                    ...currentCandidate,
                    faces,
                    faceCount: faces.length,
                };
            });
        });
    };

    const mergeSelectedSubjectCandidateClusters = () => {
        if (clustersToEdit.length < 2) {
            alert('Select at least two candidate clusters to merge.');
            return;
        }

        if (!window.confirm(`Merge ${clustersToEdit.length} selected subject candidate clusters?`)) {
            return;
        }

        window.api.mergeSubjectCandidateClusters(clustersToEdit).then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }
            showGlobalNotification('Subjects are merged.');

            fetchSubjectCandidateClusters();
        });
    };

    const removeSelectedSubjectCandidateClusters = () => {
        if (clustersToEdit.length === 0) {
            alert('Select at least one candidate cluster to delete.');
            return;
        }

        if (
            !window.confirm(
                `Delete ${clustersToEdit.length} selected subject candidate cluster(s) and all retained faces? This cannot be undone.`,
            )
        ) {
            return;
        }

        window.api.deleteSubjectCandidateCluster(clustersToEdit.map((candidate) => candidate.id)).then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }
            showGlobalNotification('Selected subject candidates are deleted.');

            fetchSubjectCandidateClusters();
        });
    };

    const toggleRepresentativeFace = (faceId, isRepresentative) => {
        if (!selectedCandidate?.id || !faceId) {
            return;
        }

        window.api.toggleRepresentativeFaceFromSubjectCandidate(selectedCandidate.id, faceId, isRepresentative).then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }

            showGlobalNotification('Representative face updated.');

            const updateCandidate = (candidate) => {
                if (candidate.id !== selectedCandidate.id) {
                    return candidate;
                }

                return {
                    ...candidate,
                    faces: (candidate.faces || []).map((face) =>
                        face.id === faceId
                            ? {
                                  ...face,
                                  isRepresentative,
                                  representativeRank: isRepresentative ? face.representativeRank : null,
                              }
                            : face,
                    ),
                };
            };

            setSubjectCandidateList((currentList) => currentList.map(updateCandidate));
            setSelectedCandidate((currentCandidate) => (currentCandidate ? updateCandidate(currentCandidate) : currentCandidate));
        });
    };

    const moveFaceOutOfCluster = (clusterId, faceId) => {
        if (!clusterId || !faceId) {
            return;
        }

        if (!window.confirm('Move this face out of this subject?')) {
            return;
        }

        window.api.splitSubjectCandidateCluster(clusterId, [faceId]).then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }
            showGlobalNotification('The face is removed out of this subject.');

            fetchSubjectCandidateClusters();
        });
    };

    const removeSubjectCandidate = () => {
        if (!selectedCandidate?.id) {
            return;
        }

        if (!window.confirm('Delete this subject candidate and all retained faces? This cannot be undone.')) {
            return;
        }

        window.api.deleteSubjectCandidateCluster([selectedCandidate.id]).then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }

            closeCandidateModal();
            fetchSubjectCandidateClusters();
        });
    };

    const identifySelectedSubjectCandidate = () => {
        if (!selectedCandidate?.id) {
            return;
        }

        if (!isCandidateNameValid) {
            alert('Subject name can contain only letters, numbers, roman numerals, and spaces.');
            return;
        }

        window.api.identifySubjectCandidate(selectedCandidate.id, candidateName.trim()).then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }
            showGlobalNotification('Subject is named');

            fetchSubjectCandidateClusters();
        });
    };

    useEffect(() => {
        fetchSubjectCandidateClusters();
    }, []);

    return {
        subjectCandidateList,
        visibleCandidateList,
        selectedCandidate,
        candidateName,
        candidateFilter,
        knownFacesSearchText,
        setKnownFacesSearchText,
        isCandidateNameValid,
        isCandidateNameChanged,
        isMultiEditEnabled,
        setCandidateName: updateCandidateName,
        setCandidateFilter: updateCandidateFilter,
        toggleMultiEdit,
        fetchSubjectCandidateClusters,
        openCandidateModal,
        closeCandidateModal,
        removeFaceFromSubject,
        clustersToEdit,
        isCandidateSelectedForEdit,
        toggleCandidateForEdit,
        mergeSelectedSubjectCandidateClusters,
        removeSelectedSubjectCandidateClusters,
        toggleRepresentativeFace,
        moveFaceOutOfCluster,
        removeSubjectCandidate,
        identifySelectedSubjectCandidate,
    };
};

export default useSubjectCandidateReview;
