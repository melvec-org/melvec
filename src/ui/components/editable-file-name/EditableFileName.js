// similar to editable title.js
import React, { useEffect, useState } from 'react';
import formStyles from '__styles/forms.css';
import Button from '__components/core-components/button/Button';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';
import { VIDEO_FILE_NAME_MAX_LENGTH, VIDEO_FILE_NAME_MIN_LENGTH, VIDEO_FILE_NAME_PATTERN } from '../../configs/constraints';
import { registerAccKeyListener, unregisterAccKeyListener } from '__utils/acceleratorKeysListenerRegistry';
import applicationMenuEvents from '__events/applicationMenuEvents';
import responseStatus from '__constants/responseStatus';

const FileNameEditForm = ({ mediaId, mediaFileName, mediaType = 'video', onNameEditDone, onCancel }) => {
    const [fileNameWithoutExtn, setFileNameWithoutExtn] = useState(mediaFileName);
    const [extn, setExtn] = useState('');

    const onFilenameChange = (newValue) => {
        setFileNameWithoutExtn(newValue);
    };

    const saveFileName = () => {
        const trimmedFileName = fileNameWithoutExtn.trim();
        if (trimmedFileName === '') {
            return;
        }

        const fullFileName = `${trimmedFileName}.${extn}`;
        window.api.renameMediaFile(mediaType, mediaId, mediaFileName, fullFileName).then((data) => {
            if (data && data.status === responseStatus.SUCCESS && onNameEditDone !== null) {
                onNameEditDone(mediaId, fullFileName);
            } else {
                alert('Failed to rename media file.', data?.message);
            }
        });
    };

    const onFileNameEditCancel = () => {
        onCancel();
    };

    const onFileNameInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            saveFileName();
        }
    };

    useEffect(() => {
        const nameParts = mediaFileName.split('.');
        if (nameParts.length > 1) {
            setExtn(nameParts.pop());
            setFileNameWithoutExtn(nameParts.join('.'));
        } else {
            setExtn('');
            setFileNameWithoutExtn(mediaFileName);
        }
    }, [mediaId, mediaFileName]);

    return (
        <div>
            <h3>
                Change the filename from <em>"{mediaFileName}"</em>
            </h3>
            <div className={formStyles.formSection}>
                <input
                    type="text"
                    value={fileNameWithoutExtn}
                    placeholder={'Please enter a new filename'}
                    minLength={VIDEO_FILE_NAME_MIN_LENGTH}
                    maxLength={VIDEO_FILE_NAME_MAX_LENGTH}
                    spellCheck="true"
                    // pattern that allowed all alpha numeric character, spaces, and underscores, with case insensitivity, punctuations but no emojis, no control characters, no assignment operators, and symbols
                    pattern={VIDEO_FILE_NAME_PATTERN}
                    className={formStyles.formTextInputLarge}
                    required={true}
                    title={
                        '2–210 characters: only letters, numbers, hyphen (-), underscore (_). Must start and end with a letter or number.'
                    }
                    onChange={(e) => onFilenameChange(e.target.value)}
                    onKeyDown={(e) => onFileNameInputKeyDown(e)}
                />
                {extn !== '' && <span>{`.${extn}`}</span>}
            </div>
            <ModalActionFooter>
                <Button onClick={() => onFileNameEditCancel()}>Cancel</Button>
                <span className={'ml10'}>
                    {`${fileNameWithoutExtn}${extn !== '' ? `.${extn}` : ''}` !== mediaFileName && fileNameWithoutExtn !== '' && (
                        <Button type="primaryBtn" onClick={() => saveFileName()}>
                            Change
                        </Button>
                    )}
                </span>
            </ModalActionFooter>
        </div>
    );
};
const EditableFileName = ({ mediaId, mediaFileName, mediaType = 'video', onFileNameChange }) => {
    const [isFileNameEditorOpen, setIsFieNameEditorOpen] = useState(false);
    const [fileName, setFileName] = useState(mediaFileName);

    const openFileNameEditor = () => {
        setIsFieNameEditorOpen(true);
    };

    const onNameEditDone = (id, newName) => {
        setFileName(newName);
        onFileNameChange(id, newName);
        setIsFieNameEditorOpen(false);
    };

    const onApplicationMenuCommand = () => {
        if (!isFileNameEditorOpen) {
            openFileNameEditor();
        }
    };

    useEffect(() => {
        setFileName(mediaFileName);
    }, [mediaId, mediaFileName]);

    useEffect(() => {
        registerAccKeyListener(applicationMenuEvents.EDIT_FILE_NAME, onApplicationMenuCommand);
        return () => {
            unregisterAccKeyListener(applicationMenuEvents.EDIT_FILE_NAME);
        };
    }, []);

    return (
        <>
            <h3 title="Click to edit this file name (Cmd+N)" onClick={() => openFileNameEditor()} tabIndex={0}>
                {fileName}
            </h3>
            {isFileNameEditorOpen && (
                <Modal isOpen={isFileNameEditorOpen} onClose={() => setIsFieNameEditorOpen(false)}>
                    <FileNameEditForm
                        mediaId={mediaId}
                        mediaFileName={fileName}
                        mediaType={mediaType}
                        onNameEditDone={onNameEditDone}
                        onCancel={() => setIsFieNameEditorOpen(false)}
                    />
                </Modal>
            )}
        </>
    );
};

export default EditableFileName;
