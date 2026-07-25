import AddNewPlaylist from '__components/add-playlist/AddNewPlaylist';
import Collections from '__components/collections/Collections';
import IconButton from '__components/core-components/icon-button/IconButton';
import { useApplicationContext } from '__contexts/app.context';
import React, { useState } from 'react';

const CollectionControlButton = ({ onControlClick }) => {
    return (
        <IconButton
            icon="add"
            title={'Add a new playlist'}
            onClick={() => onControlClick()}
            className="collection-header"
        ></IconButton>
    );
};
const UserPlaylist = ({ onCollectionItemClick, selectedItemId }) => {
    const [stateContext] = useApplicationContext();
    const [openNewPlaylist, setIsOpenNewPlaylist] = useState(false);

    const onNewPlaylistAdded = (newPlaylistName) => {
        if (newPlaylistName == null) {
            setIsOpenNewPlaylist(false);
        }
    };

    return (
        <>
            <Collections
                collection={stateContext.playlists}
                collectionType="play"
                collectionsName={'userPlaylist'}
                collectionHeader={'Your Playlists'}
                onCollectionItemClick={onCollectionItemClick}
                selectedItemId={selectedItemId}
                headerControls={<CollectionControlButton onControlClick={() => setIsOpenNewPlaylist(true)} />}
            />
            {openNewPlaylist && (
                <AddNewPlaylist onPlaylistAdd={onNewPlaylistAdded} playlists={stateContext.playlists} />
            )}
        </>
    );
};

export default UserPlaylist;
