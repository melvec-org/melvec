import React, { useEffect, useState } from 'react';
import TagChip from '../editable-tag-list/TagChip';
import EditablePLaylistStyle from './EditablePlaylistStyle.css';

import Button from '__components/core-components/button/Button';
import PlaylistEditForm from './PlaylistEditForm';
import Modal from '__components/core-components/modal/Modal';
import { registerAccKeyListener, unregisterAccKeyListener } from '__utils/acceleratorKeysListenerRegistry';
import applicationMenuEvents from '__events/applicationMenuEvents';

const EditablePlaylist = ({ videoId = '', preselectedPlaylists = [], videoTitle = '' }) => {
    const [playlists, setPlaylists] = useState(preselectedPlaylists);
    const [isPlaylistEditorOpen, setIsPlaylistEditorOpen] = useState(false);
    const [closePlaylistEditForm, setClosePlaylistEditForm] = useState(false);

    const onPlaylistEditDone = (usedPlaylists) => {
        setPlaylists(usedPlaylists);
        setIsPlaylistEditorOpen(false);
    };

    useEffect(() => {
        setPlaylists(preselectedPlaylists);
    }, [videoId, preselectedPlaylists]);

    const onApplicationMenuCommand = () => {
        if (!isPlaylistEditorOpen) {
            if (playlists.length === 0 || playlists.length) {
                setClosePlaylistEditForm(false);
                setIsPlaylistEditorOpen(true);
            }
        }
    };

    useEffect(() => {
        registerAccKeyListener(applicationMenuEvents.MANAGE_PLAYLISTS, onApplicationMenuCommand);
        return () => {
            unregisterAccKeyListener(applicationMenuEvents.MANAGE_PLAYLISTS);
        };
    }, []);

    if (videoId === '') return null; // Return early if videoId is not provided
    return (
        <>
            <div>
                {playlists.length > 0 &&
                    playlists.map((item) => {
                        return <TagChip key={item.id} label={item.label} id={item.id} />;
                    })}

                {(playlists.length === 0 || playlists.length > 0) && (
                    <Button
                        type="transparentBtn"
                        onClick={() => {
                            setClosePlaylistEditForm(false);
                            setIsPlaylistEditorOpen(true);
                        }}
                        title="Click to manage playlists(Cmd+P)"
                    >
                        Manage playlists
                    </Button>
                )}
            </div>

            {isPlaylistEditorOpen && (
                <Modal
                    isOpen={isPlaylistEditorOpen}
                    onClose={() => {
                        setClosePlaylistEditForm(true);
                    }}
                    modifierClasses={EditablePLaylistStyle.playlistEditModal}
                >
                    <PlaylistEditForm
                        videoTitle={videoTitle}
                        videoId={videoId}
                        onPlaylistEditDone={onPlaylistEditDone}
                        existingPlaylists={playlists}
                        onCancel={onPlaylistEditDone}
                        closePlaylistEditForm={closePlaylistEditForm}
                    />
                </Modal>
            )}
        </>
    );
};

export default EditablePlaylist;
