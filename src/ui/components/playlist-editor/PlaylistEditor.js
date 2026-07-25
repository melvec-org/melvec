import React, { useState, useEffect } from 'react';
import Modal from '__components/core-components/modal/Modal';
import Button from '__components/core-components/button/Button';
import ErrorMessage from '__components/core-components/inline-message/ErrorMessage';
import { ModalActionFooter } from '__components/core-components/modal/Modal';
import formStyles from '__styles/forms.css';
import usePlaylistActions from '__actions/usePlaylistActions';
import validateNewPlaylistName from '__utils/validateNewPlaylistName';

const PlaylistEditor = ({ playlist, onEditDone, playlistsList }) => {
    const [editedPlaylist, setEditedPlaylist] = useState(playlist);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [validationError, setValidationError] = useState('');

    const { renamePlaylist } = usePlaylistActions();

    const onPlaylistChange = (val) => {
        setEditedPlaylist({ ...editedPlaylist, label: val });
    };

    const onPlaylistSave = () => {
        const trimmedLabel = editedPlaylist.label.trim();
        const validationStatus = validateNewPlaylistName(trimmedLabel, playlistsList);
        if (validationStatus.isValid) {
            renamePlaylist(editedPlaylist.id, editedPlaylist.label);
            onEditDone(editedPlaylist);
        } else {
            setValidationError(validationStatus.error);
        }
    };

    const onCancel = () => {
        setIsEditorOpen(false);
        onEditDone(null);
    };
    const onPlaylistInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            onPlaylistSave();
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
                        <h3>Edit playlist "{playlist.label}"</h3>
                        <div className={formStyles.formControlWrapper}>
                            <input
                                type="text"
                                className={formStyles.formTextInputLarge}
                                value={editedPlaylist.label}
                                onChange={(e) => onPlaylistChange(e.target.value)}
                                placeholder="Enter a playlist name"
                                onKeyDown={(e) => onPlaylistInputKeyDown(e)}
                            />
                            {validationError && <ErrorMessage msg={validationError} />}
                            <ModalActionFooter>
                                <Button onClick={() => onCancel()}>Cancel</Button>
                                <Button type="primaryBtn" onClick={() => onPlaylistSave()}>
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

export default PlaylistEditor;
