import React from 'react';
import style from './SubjectCandidateReview.css';
import formStyles from '__styles/forms.css';
import Button from '__components/core-components/button/Button';
import PaginatedList from '__components/core-components/paginated-list/PaginatedList';
import SubjectFace from '__components/core-components/subject-face/SubjectFace';
import {
    HeaderControlBar,
    HeaderControlBarLeft,
    HeaderControlBarRight,
} from '__components/core-components/header-control-bar/HeaderControlBar';

const SubjectCandidateList = ({
    visibleCandidateList,
    candidateFilter,
    knownFacesSearchText,
    setKnownFacesSearchText,
    isMultiEditEnabled,
    clustersToEdit,
    setCandidateFilter,
    toggleMultiEdit,
    fetchSubjectCandidateClusters,
    openCandidateModal,
    isCandidateSelectedForEdit,
    toggleCandidateForEdit,
    mergeSelectedSubjectCandidateClusters,
    removeSelectedSubjectCandidateClusters,
}) => {
    return (
        <>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <div className={formStyles.formInputWrapper}>
                        <input
                            type="checkbox"
                            id="multiSelectionOn"
                            className={formStyles.formInputCheckBox}
                            checked={isMultiEditEnabled}
                            onChange={(event) => toggleMultiEdit(event.target.checked)}
                        />
                        <label htmlFor="multiSelectionOn">Toggle multiselect</label>
                    </div>
                </HeaderControlBarLeft>
                <HeaderControlBarRight>
                    {candidateFilter === 'identified' && (
                        <input
                            placeholder="Search subjects"
                            type="search"
                            value={knownFacesSearchText}
                            onChange={(event) => setKnownFacesSearchText(event.target.value)}
                        />
                    )}

                    <select value={candidateFilter} onChange={(event) => setCandidateFilter(event.target.value)}>
                        <option value="pending">Unknown faces</option>
                        <option value="identified">Known faces</option>
                    </select>
                    <Button onClick={fetchSubjectCandidateClusters}>Refresh</Button>
                </HeaderControlBarRight>
            </HeaderControlBar>

            {visibleCandidateList.length === 0 && (
                <div className="secondaryInfo">
                    {candidateFilter === 'pending' ? 'No unidentified subject candidates found.' : 'No identified subjects found.'}
                </div>
            )}

            {isMultiEditEnabled && clustersToEdit.length > 0 && (
                <div className={style.multiClusterEditContainer}>
                    <div className={style.clustersList}>
                        {clustersToEdit.map((item) => (
                            <SubjectFace
                                key={item.id}
                                face={item.faces[0]}
                                className={style.selectedClusterFace}
                                faceCount={item.faces.length}
                            ></SubjectFace>
                        ))}
                    </div>
                    <div className={style.multiClusterEditControl}>
                        <Button type="primaryBtn" disabled={clustersToEdit.length < 2} onClick={mergeSelectedSubjectCandidateClusters}>
                            Merge selected ({clustersToEdit.length})
                        </Button>
                        <Button onClick={removeSelectedSubjectCandidateClusters}>Delete all</Button>
                    </div>
                </div>
            )}

            {visibleCandidateList.length > 0 && (
                <PaginatedList items={visibleCandidateList} pageSize={100}>
                    {(candidateList) => (
                        <div className={style.candidateListContainer}>
                            {candidateList.map((candidate) => (
                                <div key={candidate.id} className={style.subjectCandidate}>
                                    <div className={style.candidatePreview}>
                                        <SubjectFace face={candidate.faces[0]} />
                                        <div className={style.candidatePreviewOverlay}>
                                            <Button title="Edit images and identify subject" onClick={() => openCandidateModal(candidate)}>
                                                Edit
                                            </Button>
                                        </div>
                                        {isMultiEditEnabled && (
                                            <input
                                                type="checkbox"
                                                title="Select this cluster for merge"
                                                className={`${formStyles.formInputCheckBox} ${style.candidateSelectionControl}`}
                                                checked={isCandidateSelectedForEdit(candidate.id)}
                                                onChange={() => toggleCandidateForEdit(candidate)}
                                            />
                                        )}
                                    </div>
                                    <div className={style.candidateName}>{candidate.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </PaginatedList>
            )}
        </>
    );
};

export default SubjectCandidateList;
