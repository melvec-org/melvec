import Button from '__components/core-components/button/Button';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';
import keyCodes from '__constants/keyCodes';
import React, { useEffect, useState } from 'react';

const CollectionEditForm = ({ collections, onCancel, onCollectionSelect, preselectedLabel, isExternal }) => {
    const getInitialCollection = () => {
        const matched = collections.find((item) => item.label === preselectedLabel);
        if (matched) return matched;
        return isExternal ? (collections[0] ?? null) : (collections[0] ?? null);
    };

    const [selectedCollection, setSelectedCollection] = useState(getInitialCollection);

    const onSelectionChange = (event) => {
        setSelectedCollection(collections.find((item) => item.id === event.target.value));
    };

    useEffect(() => {
        setSelectedCollection(getInitialCollection());
    }, [preselectedLabel]);

    return (
        <div>
            <h3>Change collection</h3>
            <div className="mt15">
                {selectedCollection && (
                    <select onChange={onSelectionChange} spellCheck={false} value={selectedCollection.id}>
                        {collections.map((item) => (
                            <option value={item.id} key={item.id}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            <ModalActionFooter>
                <Button onClick={() => onCancel()}>Cancel</Button>
                {selectedCollection && (
                    <span className="ml10">
                        {selectedCollection.label !== preselectedLabel && (
                            <Button
                                type="primaryBtn"
                                onClick={() => {
                                    onCollectionSelect(selectedCollection);
                                }}
                            >
                                Change
                            </Button>
                        )}
                    </span>
                )}
            </ModalActionFooter>
        </div>
    );
};

const EditableCollection = ({ label = '', selectionList = [], mediaId = '', isExternal = false, onCollectionChange, mediaType }) => {
    const [selectedLabel, setSelectedLabel] = useState(label);
    const [isCollectionEditorOpen, setIsCollectionEditorOpen] = useState(false);

    useEffect(() => {
        if (mediaId != '') {
            setSelectedLabel(label);
        }
    }, [mediaId, label]);

    const onSelectionChange = (collection) => {
        if (isExternal && !window.confirm(`Are you sure you want to change the collection to ${collection.label}?`)) {
            return;
        }

        const oldCollection = selectionList.find((item) => item.label === selectedLabel);
        const newSelectionLabel = collection.label;
        const newCollection = selectionList.find((item) => item.id === collection.id);

        if (!isExternal) {
            onCollectionChange({
                mediaType: mediaType,
                mediaId: mediaId,
                newCollection: newCollection,
                oldCollection: oldCollection,
                isExternal: false,
            });
        } else {
            onCollectionChange({
                mediaType: mediaType,
                mediaId: mediaId,
                newCollection: newCollection,
                oldCollection: null,
                isExternal: true,
            });
        }

        setSelectedLabel(newSelectionLabel);
    };

    const onLabelClick = (e) => {
        if (e.key === keyCodes.ENTER || e.key === keyCodes.SPACE) {
            setIsCollectionEditorOpen(true);
        }
    };

    return (
        <div>
            <div onClick={() => setIsCollectionEditorOpen(true)} tabIndex={0} onKeyDown={onLabelClick} title="Click to edit" role="Button">
                {selectedLabel}
            </div>
            {isCollectionEditorOpen && (
                <Modal isOpen={isCollectionEditorOpen} onClose={() => setIsCollectionEditorOpen(false)}>
                    <CollectionEditForm
                        collections={selectionList}
                        preselectedLabel={selectedLabel}
                        isExternal={isExternal}
                        onCancel={() => setIsCollectionEditorOpen(false)}
                        onCollectionSelect={(collection) => {
                            onSelectionChange(collection);
                            setIsCollectionEditorOpen(false);
                        }}
                    />
                </Modal>
            )}
        </div>
    );
};

export default EditableCollection;
