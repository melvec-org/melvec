import React, { useState } from 'react';
import Collections from '__components/collections/Collections';
import contextMenuEvents from '__events/contextMenuEvents';
import ipcChannels from '__constants/ipcChannels';
import AddNewCollection from '__components/add-collection/AddNewCollection';
import IconButton from '__components/core-components/icon-button/IconButton';
import useCollectionActions from '__actions/useCollectionActions';
import CollectionEditor from '__components/collection-editor/CollectionEditor';

const CollectionControlButton = ({ onControlClick }) => {
    return (
        <IconButton icon="add" title={'Add a new collection'} onClick={() => onControlClick()} className="collection-header"></IconButton>
    );
};

const LibraryCollection = ({ collections, onCollectionItemClick, selectedItemId }) => {
    const [openNewCollection, setIsOpenNewCollection] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [collectionToEdit, setCollectionToEdit] = useState(null);

    const { hideCollection, unhideCollection } = useCollectionActions();

    const onNewCollectionAdded = (newCollectionName) => {
        if (newCollectionName == null) {
            setIsOpenNewCollection(false);
        }
    };

    const collectionItemContextMenuClick = (event, item) => {
        event.preventDefault();

        window.api.receiveOnce(ipcChannels.CONTEXT_MENU_ACTION, (command, data) => {
            switch (command) {
                case contextMenuEvents.RENAME_COLLECTION:
                    setCollectionToEdit(data || item);
                    break;
                case contextMenuEvents.TOGGLE_IS_HIDDEN:
                    if (item.isHidden === 1 || item.isHidden === 'true') {
                        unhideCollection(item.id);
                    } else {
                        hideCollection(item.id);
                    }
                    break;
                default:
                    break;
            }
        });

        window.api.send(ipcChannels.CONTEXT_MENU_REQUEST, {
            source: 'librarySidebarCollectionItem',

            collectionItem: item,
        });
    };
    const collectionContextMenuClick = (event, item) => {
        event.preventDefault();
        window.api.receiveOnce(ipcChannels.CONTEXT_MENU_ACTION, (command) => {
            switch (command) {
                case contextMenuEvents.ADD_NEW_COLLECTION:
                    setIsOpenNewCollection(true);
                    break;
                case contextMenuEvents.TOGGLE_SECTION:
                    setIsCollapsed((prevState) => !prevState);
                    break;
                default:
                    break;
            }
        });
        window.api.send(ipcChannels.CONTEXT_MENU_REQUEST, {
            source: 'librarySidebar',

            collectionItem: item,
        });
    };

    return (
        <>
            <Collections
                collection={collections}
                collectionHeader="Library"
                onCollectionItemClick={(item) => onCollectionItemClick(item, false)}
                contextMenuClick={(event, item) => collectionContextMenuClick(event, item)}
                selectedItemId={selectedItemId}
                collectionItemContextMenuClick={collectionItemContextMenuClick}
                headerControls={<CollectionControlButton onControlClick={() => setIsOpenNewCollection(true)} />}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed((prevState) => !prevState)}
            />
            {openNewCollection && <AddNewCollection onCollectionAdd={onNewCollectionAdded} />}
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

export default LibraryCollection;
