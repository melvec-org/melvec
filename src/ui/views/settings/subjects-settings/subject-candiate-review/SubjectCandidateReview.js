import React from 'react';
import useSubjectCandidateReview from './useSubjectCandidateReview';
import SubjectCandidateList from './SubjectCandidateList';
import SubjectCandidateModalContent from './SubjectCandidateModalContent';
import Modal from '__components/core-components/modal/Modal';

const SubjectCandidateReview = () => {
    const candidateReview = useSubjectCandidateReview();

    return (
        <div>
            <SubjectCandidateList {...candidateReview} />

            <Modal isOpen={!!candidateReview.selectedCandidate} onClose={candidateReview.closeCandidateModal} modifierClasses="regModal">
                <SubjectCandidateModalContent {...candidateReview} />
            </Modal>
        </div>
    );
};

export default SubjectCandidateReview;
