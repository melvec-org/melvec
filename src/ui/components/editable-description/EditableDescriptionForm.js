import Button from '__components/core-components/button/Button';
import { useApplicationContext } from '__contexts/app.context';
import React, { useState, useEffect } from 'react';
import formStyles from '__styles/forms.css';
import { ModalActionFooter } from '__components/core-components/modal/Modal';
import { IMAGE_DESCRIPTION_MAX_LENGTH, VIDEO_DESCRIPTION_MAX_LENGTH } from '../../configs/constraints';
import useEditableDescriptionAction from './useEditableDescriptionAction';
import mediaTypes from '__constants/mediaTypes';

const EditableDescriptionForm = ({ mediaId, mediaTitle = '', onDescriptionEditDone, mediaType = mediaTypes.VIDEO }) => {
    const [stateContext] = useApplicationContext();
    const isAISupported = stateContext?.userPreferences?.isAISupported && stateContext?.userPreferences?.isAIEnabled;
    const [isDescriptionChanged, setIsDescriptionChanged] = useState(false);

    const {
        saveDescription,
        generateAIDescription,
        isDescGenInProgress,
        getMediaMetaDataDetails,
        metaData,
        setMetaData,
        metaDataFromServer,
        generateTranscript,
        stopGeneratingAIDescription,
        shouldGenerateTitle,
        setShouldGenerateTitle,
        isDescProcessing,
    } = useEditableDescriptionAction();

    // keep a separate copy of metadata for comparison

    const onDescriptionEdit = (e) => {
        const newValue = e.target.value;

        if (newValue !== metaDataFromServer.description && newValue.trim() !== '' && newValue.length > 5) {
            setIsDescriptionChanged(true);
        } else {
            setIsDescriptionChanged(false);
        }
        setMetaData({ ...metaData, description: newValue, descriptionSource: 'user' });
    };

    useEffect(() => {
        if (mediaId) {
            getMediaMetaDataDetails(mediaType, mediaId);
        }
    }, [mediaId]);

    const descriptionMaxLength = mediaType === mediaTypes.VIDEO ? VIDEO_DESCRIPTION_MAX_LENGTH : IMAGE_DESCRIPTION_MAX_LENGTH;

    return (
        <div>
            <h3>Description details : {mediaTitle}</h3>
            {metaData.description !== null && (
                <div className={formStyles.formSection}>
                    <h4>Description</h4>
                    <textarea
                        className={formStyles.formTextArea}
                        value={metaData.description ?? ''}
                        onChange={(e) => onDescriptionEdit(e)}
                        minLength={5}
                        maxLength={descriptionMaxLength}
                        disabled={isDescGenInProgress}
                    />

                    <div className={formStyles.formControlWrapper}>
                        <div className={formStyles.formInputWrapper}>
                            {isAISupported && (
                                <>
                                    <input
                                        type="checkbox"
                                        id="generateTitle"
                                        className={formStyles.formInputCheckbox}
                                        checked={shouldGenerateTitle}
                                        onChange={() => setShouldGenerateTitle(!shouldGenerateTitle)}
                                    />
                                    <label htmlFor="generateTitle">Generate title </label>
                                    <Button onClick={() => generateAIDescription(mediaType, mediaId)} processing={isDescGenInProgress}>
                                        Generate AI description
                                    </Button>
                                </>
                            )}
                            {isDescGenInProgress && (
                                <Button type="primaryBtn" onClick={() => stopGeneratingAIDescription(mediaType, mediaId)}>
                                    Stop generation
                                </Button>
                            )}

                            {!isDescGenInProgress && (
                                <Button
                                    disabled={!isDescriptionChanged}
                                    processing={isDescProcessing}
                                    onClick={() => saveDescription(mediaType, mediaId, metaData.description)}
                                >
                                    Save Description
                                </Button>
                            )}
                        </div>
                        {isAISupported && (
                            <p className="secondaryInfo">
                                <strong>Notes:</strong> AI based description generation may take few seconds/minutes based your system,
                                length and quality of the AI model tier you have selected
                            </p>
                        )}
                    </div>
                </div>
            )}

            {mediaType === mediaTypes.VIDEO && isAISupported && metaData.transcript !== null && (
                <div className={formStyles.formSection}>
                    <h4>Audio Transcript</h4>

                    <p className="clampedBox">{metaData.transcript !== '' ? metaData.transcript : 'No transcript available'}</p>
                    {metaData.transcript === '' && metaData.transcriptSource !== 'AI' && (
                        <Button onClick={() => generateTranscript(mediaId)}>Generate Transcript</Button>
                    )}
                </div>
            )}
            <ModalActionFooter>
                <Button onClick={() => onDescriptionEditDone()}>Close</Button>
            </ModalActionFooter>
        </div>
    );
};

export default EditableDescriptionForm;
