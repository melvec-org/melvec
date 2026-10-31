import React from 'react';
import formStyles from '__styles/forms.css';
import Button from '__components/core-components/button/Button';
import useSubjectsSettings from './useSubjectsSettings';
import SubjectCandidateReview from './subject-candiate-review/SubjectCandidateReview';

const SubjectsSettings = () => {
    const {
        startFaceExtraction,
        stopFaceExtraction,
        faceExtractionStatus,
        isFaceExtractionInProgress,
        pendingFaceExtractionCount,
        isPendingFaceExtractionCountLoading,
        shouldShowFaceExtractionSection,
    } = useSubjectsSettings();

    return (
        <>
            {!isPendingFaceExtractionCountLoading && shouldShowFaceExtractionSection && (
                <div className="extraction">
                    <p>
                        Start face extraction to detect faces across your library. Detected faces can later be reviewed, named, and used as
                        subjects in search.
                    </p>

                    <div className="secondaryInfo mt10">{pendingFaceExtractionCount} media item(s) pending face extraction.</div>

                    <div className={formStyles.formInputWrapper}>
                        <Button onClick={() => startFaceExtraction()} disabled={isFaceExtractionInProgress}>
                            {isFaceExtractionInProgress ? 'Face extraction in progress' : 'Start face extraction'}
                        </Button>

                        {isFaceExtractionInProgress && (
                            <Button type={'primaryBtn'} onClick={() => stopFaceExtraction()}>
                                Stop face extraction
                            </Button>
                        )}
                    </div>

                    <div className="secondaryInfo mt10">
                        {faceExtractionStatus?.progress?.message && <div>{faceExtractionStatus.progress.message}</div>}

                        {faceExtractionStatus?.error && <div>Error: {faceExtractionStatus.error}</div>}
                    </div>
                </div>
            )}

            <SubjectCandidateReview />
        </>
    );
};

export default SubjectsSettings;
