import { useState } from 'react';
import responseStatus from '__constants/responseStatus';
import { showGlobalNotification } from '__contexts/AppNotificationContext';

const useEditableSubjects = (subjects, mediaId, mediaType, onSubjectsChange) => {
    const [isExtractingSubjects, setIsExtractingSubjects] = useState(false);

    const fetchSubjectDetails = async () => {
        const response = await window.api.getSubjectsByMedia(mediaType, mediaId);

        if (response.status === responseStatus.SUCCESS) {
            onSubjectsChange(response.data || []);
            return response.data || [];
        }

        alert(response.message);
        return [];
    };

    const deleteSubject = (subject) => {
        window.api.removeSubjectCandidateFromMedia(mediaType, mediaId, subject.id, subject.face.id).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                fetchSubjectDetails();
            } else {
                alert(response.message);
            }
        });
    };

    const onSubjectNameChange = (subject, newName) => {
        window.api.identifySubjectCandidate(subject.id, newName).then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }
            showGlobalNotification('Subject is named');

            fetchSubjectDetails();
        });
    };

    const extractSubjects = async () => {
        const shouldExtract = window.confirm(
            'This will delete the currently extracted faces for this media and run face / subject extraction again. Continue?',
        );

        if (!shouldExtract) {
            return;
        }

        setIsExtractingSubjects(true);

        try {
            const response = await window.api.extractFacesFromMedia(mediaId, mediaType);

            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
                return;
            }

            await fetchSubjectDetails();
            showGlobalNotification('Face / subject extraction completed');
        } finally {
            setIsExtractingSubjects(false);
        }
    };

    return {
        deleteSubject,
        fetchSubjectDetails,
        onSubjectNameChange,
        extractSubjects,
        isExtractingSubjects,
    };
};

export default useEditableSubjects;
