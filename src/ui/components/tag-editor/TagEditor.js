// import all dependencies

import React, { useState, useEffect } from 'react';
import Modal from '__components/core-components/modal/Modal';
import Button from '__components/core-components/button/Button';
import ErrorMessage from '__components/core-components/inline-message/ErrorMessage';

import validateNewTagName from '__utils/validateNewTagName';
import { ModalActionFooter } from '__components/core-components/modal/Modal';
import formStyles from '__styles/forms.css';
import useTagActions from '__actions/useTagActions';

const TagEditor = ({ tag, onEditDone, tagsList }) => {
    const [editedTag, setEditedTag] = useState(tag);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [validationError, setValidationError] = useState('');

    const { renameTag } = useTagActions();

    const onTagChange = (val) => {
        setEditedTag({ ...editedTag, label: val });
    };

    const onTagSave = () => {
        const trimmedLabel = editedTag.label.trim();
        // return if blank

        if (trimmedLabel === '') return;
        const validationStatus = validateNewTagName(trimmedLabel, tagsList);

        if (validationStatus.isValid) {
            renameTag(editedTag.id, editedTag.label);
            onEditDone(editedTag);
        } else {
            setValidationError(validationStatus.error);
        }
    };

    const onCancel = () => {
        setIsEditorOpen(false);
        onEditDone(null);
    };

    const onTagInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            onTagSave();
        }
    };

    useEffect(() => {
        setIsEditorOpen(true);
        return () => {
            setIsEditorOpen(false);
        };
    }, []);

    return (
        <div>
            {isEditorOpen && (
                <Modal isOpen={isEditorOpen} onClose={() => onCancel()}>
                    <>
                        <h3>Edit tag "{tag.label}"</h3>
                        <div className={formStyles.formControlWrapper}>
                            <input
                                type="text"
                                className={formStyles.formTextInputLarge}
                                value={editedTag.label}
                                onChange={(e) => onTagChange(e.target.value)}
                                placeholder="Enter a tag name"
                                onKeyDown={(e) => onTagInputKeyDown(e)}
                            />
                            {validationError && <ErrorMessage msg={validationError} />}
                            <ModalActionFooter>
                                <Button onClick={() => onTagSave()}>Save</Button>
                                <Button onClick={() => onCancel()}>Cancel</Button>
                            </ModalActionFooter>
                        </div>
                    </>
                </Modal>
            )}
        </div>
    );
};

export default TagEditor;
