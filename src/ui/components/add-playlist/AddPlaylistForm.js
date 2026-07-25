import Button from '__components/core-components/button/Button';
import React, { useState } from 'react';
import usePlaylistActions from '__actions/usePlaylistActions';
import formStyles from '__styles/forms.css';
import getUniqueID from '../../../services/service-utils/getUniqueID.js';
import { ModalActionFooter } from '__components/core-components/modal/Modal';
import validateNewPlaylistName from '__utils/validateNewPlaylistName';

const AddPlaylistForm = ({ onPlaylistAdd, playlists = [], onCancel }) => {
    const [inputValue, setInputValue] = useState('');
    const { addNewPlaylist } = usePlaylistActions();
    const [validationError, setValidationError] = useState('');

    const onAddButtonClick = () => {
        const validationStatus = validateNewPlaylistName(inputValue, playlists);

        if (validationStatus.isValid) {
            addNewPlaylist({ label: inputValue.trim(), id: getUniqueID() });
            setInputValue('');
            onCancel();
        } else {
            setValidationError(validationStatus.error);
        }
    };

    const onPlaylistInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            onAddButtonClick();
        }
    };

    return (
        <>
            <h3>Add a new playlist</h3>

            <div className={formStyles.formControlWrapper}>
                <input
                    type="text"
                    className={formStyles.formTextInputLarge}
                    maxLength={50}
                    minLength={2}
                    placeholder={'Playlist name'}
                    value={inputValue}
                    onKeyDown={(e) => onPlaylistInputKeyDown(e)}
                    onChange={(e) => setInputValue(e.target.value)}
                />
                {validationError && <p className={'error'}>{validationError}</p>}
                <ModalActionFooter>
                    <Button onClick={() => onCancel(null)}>Cancel</Button>
                    <Button type="primaryBtn" onClick={() => onAddButtonClick()}>
                        Add playlist
                    </Button>
                </ModalActionFooter>
            </div>
        </>
    );
};

export default AddPlaylistForm;
