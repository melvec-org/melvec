import React, { useState } from 'react';
import editableListStyles from '__components/editable-list/EditableList.css';
import IconButton from '__components/core-components/icon-button/IconButton';
import useCollectionActions from '__actions/useCollectionActions';
import CollectionEditor from '__components/collection-editor/CollectionEditor';

const CollectionList = ({ collections = [] }) => {
    const { removeCollection } = useCollectionActions();
    const [collectionToEdit, setCollectionToEdit] = useState(null);

    /**
     * open a confirmation dialog before seding request to remove the collection
     * @param {*} collection
     */
    const onRemoveList = (collection) => {
        window.confirm(
            'Are you sure you want to remove this collection? \n This can not be undone and all the videos inside this will be deleted forever.',
        ) && removeCollection(collection.id);
    };

    return (
        <>
            <ul className={editableListStyles.editableListContainer}>
                {collections.map((collection) => {
                    return (
                        <li key={collection.id} className={editableListStyles.editableListItem} tabIndex={0}>
                            <span>
                                {collection.label}
                                {collection.year !== 0 && <small> ({collection.year}) </small>}
                            </span>

                            {collection.label !== 'Default collection' && (
                                <span className={editableListStyles.editableListActionGroup}>
                                    <IconButton title="Edit" icon={'edit'} onClick={() => setCollectionToEdit(collection)} />
                                    <IconButton title="Delete" icon={'close'} onClick={() => onRemoveList(collection)} />
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
            {collectionToEdit && (
                <CollectionEditor
                    collection={collectionToEdit}
                    onEditDone={() => setCollectionToEdit(null)}
                    collectionsList={collections}
                />
            )}
        </>
    );
};

export default CollectionList;
