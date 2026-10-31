import React from 'react';
import style from './SubjectCandidateReview.css';
import formStyles from '__styles/forms.css';
import IconButton from '__components/core-components/icon-button/IconButton';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';
import Button from '__components/core-components/button/Button';
import SubjectFace from '__components/core-components/subject-face/SubjectFace';

const SubjectCandidateModalContent = ({
    selectedCandidate,
    candidateName,
    isCandidateNameValid,
    isCandidateNameChanged,
    setCandidateName,
    removeFaceFromSubject,
    moveFaceOutOfCluster,
    removeSubjectCandidate,
    identifySelectedSubjectCandidate,
    closeCandidateModal,
    toggleRepresentativeFace,
}) => {
    if (!selectedCandidate) {
        return null;
    }

    return (
        <div>
            <h3>Candidate #{selectedCandidate.id}</h3>

            {selectedCandidate.faceCount > 1 && <div className="secondaryInfo mt10">{selectedCandidate.faceCount} face(s)</div>}

            <div className={style.modalFaceList}>
                {(selectedCandidate.faces || []).map((face) => (
                    <div key={face.id} className={style.modalFaceItem}>
                        <SubjectFace face={face} />
                        {selectedCandidate.faces.length > 1 && (
                            <div className={style.candidateActions}>
                                <IconButton icon="close" title="Remove this" onClick={() => removeFaceFromSubject(face.id)}></IconButton>
                                <IconButton
                                    icon="eject"
                                    title="Move this face out of this subject"
                                    onClick={() => moveFaceOutOfCluster(selectedCandidate.id, face.id)}
                                ></IconButton>
                                {face.isRepresentative && (
                                    <IconButton
                                        icon="representativeSelected"
                                        title="Remove this from representative list"
                                        onClick={() => toggleRepresentativeFace(face.id, false)}
                                    ></IconButton>
                                )}
                                {!face.isRepresentative && (
                                    <IconButton
                                        icon="representativeUnselected"
                                        title="Make this representative"
                                        onClick={() => toggleRepresentativeFace(face.id, true)}
                                    ></IconButton>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <p className="secondaryInfo">Hint: Keep max of 5 candiate faces. Prefer different different angles, looks.</p>
            <div className={formStyles.formInputWrapper}>
                <label htmlFor="subjectNameField" className={formStyles.formInputLabel}>
                    Subject name
                </label>
                <input
                    type="text"
                    className={formStyles.formTextInputLarge}
                    value={candidateName}
                    id="subjectNameField"
                    onChange={(event) => setCandidateName(event.target.value)}
                    placeholder="Enter subject name"
                />
                <Button disabled={!isCandidateNameValid || !isCandidateNameChanged} onClick={identifySelectedSubjectCandidate}>
                    Identify subject
                </Button>
            </div>

            <ModalActionFooter>
                <Button onClick={removeSubjectCandidate}>Delete this subject</Button>
                <Button onClick={closeCandidateModal}>Close</Button>
            </ModalActionFooter>
        </div>
    );
};

export default SubjectCandidateModalContent;
