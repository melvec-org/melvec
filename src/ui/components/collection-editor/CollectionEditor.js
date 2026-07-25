import React, { useState, useEffect } from 'react';
import Modal from '__components/core-components/modal/Modal';
import Button from '__components/core-components/button/Button';
import ErrorMessage from '__components/core-components/inline-message/ErrorMessage';
import { ModalActionFooter } from '__components/core-components/modal/Modal';
import formStyles from '__styles/forms.css';
import useCollectionActions from '__actions/useCollectionActions';
import validateNewCollectionName from '__utils/validateNewCollectionName';

const CollectionEditor = ({ collection, collectionsList, onEditDone }) => {
    const [editedCollection, setEditedCollection] = useState(collection);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [validationError, setValidationError] = useState('');

    const { renameCollection } = useCollectionActions();

    const onCollectionChange = (val) => {
        setEditedCollection({ ...editedCollection, label: val });

        const trimmedValue = val.trim();

        if (trimmedValue === '') {
            setValidationError('');
            return;
        }

        const validationStatus = validateNewCollectionName(trimmedValue, collectionsList, {
            excludeCollectionId: editedCollection.id,
            selectedYear: editedCollection.year,
        });

        setValidationError(validationStatus.isValid ? '' : validationStatus.error);
    };

    const onCollectionSave = () => {
        const trimmedLabel = editedCollection.label.trim();
        const validationStatus = validateNewCollectionName(trimmedLabel, collectionsList, {
            excludeCollectionId: editedCollection.id,
            selectedYear: editedCollection.year,
        });

        if (validationStatus.isValid) {
            renameCollection(editedCollection.id, trimmedLabel);
            onEditDone({ ...editedCollection, label: trimmedLabel });
        } else {
            setValidationError(validationStatus.error);
        }
    };

    const onCancel = () => {
        setIsEditorOpen(false);
        onEditDone(null);
    };

    const onCollectionInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            onCollectionSave();
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
                <Modal isOpen={isEditorOpen} onClose={() => onCancel()} modifierClasses="regModal">
                    <>
                        <h3>Edit collection "{collection.label}"</h3>
                        <div className={formStyles.formControlWrapper}>
                            <input
                                type="text"
                                className={formStyles.formTextInputLarge}
                                value={editedCollection.label}
                                onChange={(e) => onCollectionChange(e.target.value)}
                                onKeyDown={onCollectionInputKeyDown}
                            />
                            <div className={formStyles.formValidationMessage}>
                                {validationError ? <ErrorMessage msg={validationError} /> : null}
                            </div>
                            <ModalActionFooter>
                                <Button onClick={onCancel}>Cancel</Button>
                                <Button onClick={onCollectionSave} type="submit">
                                    Save
                                </Button>
                            </ModalActionFooter>
                        </div>
                    </>
                </Modal>
            )}
        </div>
    );
};

export default CollectionEditor;
