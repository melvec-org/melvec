import AddPlaylistForm from '__components/add-playlist/AddPlaylistForm';
import Modal from '__components/core-components/modal/Modal';
import React, { useEffect, useState } from 'react';

const AddNewPlaylist = ({ showEditor = true, onPlaylistAdd, playlists }) => {
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    useEffect(() => {
        setIsEditorOpen(showEditor);
    }, [showEditor]);

    const closeEditor = () => {
        setIsEditorOpen(false);
        onPlaylistAdd(null);
    };

    return (
        <div>
            {isEditorOpen && (
                <Modal isOpen={isEditorOpen} onClose={() => closeEditor()}>
                    <AddPlaylistForm playlists={playlists} onCancel={closeEditor}></AddPlaylistForm>
                </Modal>
            )}
        </div>
    );
};

export default AddNewPlaylist;
