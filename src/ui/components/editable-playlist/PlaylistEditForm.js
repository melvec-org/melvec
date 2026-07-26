import React, { useEffect, useRef, useState } from 'react';
import getRelativeComplement from '../../utils/getRelativeComplement';

import getUniqueID from '../../../services/service-utils/getUniqueID';

import TagChip from '__components/editable-tag-list/TagChip';
import DataInputList from '__components/core-components/data-input-list/DataInputList';
import Button from '__components/core-components/button/Button';
import useEditablePlaylistAction from './useEditablePlaylistAction';
import { MAX_PLAYLISTS_PER_VIDEO } from '__configs/appConfig';
import { ModalActionFooter } from '__components/core-components/modal/Modal';
import EditablePlaylistStyle from './EditablePlaylistStyle.css';
import formStyles from '__styles/forms.css';

const { useApplicationContext } = require('__contexts/app.context');

const PlaylistEditForm = ({ existingPlaylists = [], videoId, closePlaylistEditForm, onPlaylistEditDone, videoTitle }) => {
    const [stateContext] = useApplicationContext();
    const [usedPlaylists, setUsedPlaylists] = useState(existingPlaylists);
    const [unusedPlaylists, setUnusedPlaylists] = useState([]);
    const [playlistValue, setPlaylistValue] = useState('');
    const [isPlaylistSelectedFromExistingPlaylists, setPlaylistSelectedFromExistingPlaylists] = useState(null);
    const [lastUsedPlaylists, setLastUsedPlaylists] = useState([]);
    const [mostUsedPlaylists, setMostUsedPlaylists] = useState([]);

    const { addNewPlaylistToVideo, removeVideoFromPlaylist, addVideoToPlaylist } = useEditablePlaylistAction();

    const inputBoxRef = useRef(null);

    useEffect(() => {
        setUsedPlaylists(existingPlaylists);

        const unusedPlaylistsList = getRelativeComplement(stateContext.playlists, existingPlaylists);
        setUnusedPlaylists(unusedPlaylistsList);

        window.api.getLastUsedPlaylists().then((playlistsArr) => {
            let playlistHistoryArr = playlistsArr;
            playlistHistoryArr = getRelativeComplement(playlistHistoryArr, existingPlaylists);
            setLastUsedPlaylists(playlistHistoryArr);

            window.api.getMostUsedPlaylists().then((mostUsedPlaylists) => {
                const mostUsedButNotInUsed = getRelativeComplement(mostUsedPlaylists, usedPlaylists);
                const mostUsedButNotInHistory = getRelativeComplement(mostUsedButNotInUsed, playlistHistoryArr);
                setMostUsedPlaylists(mostUsedButNotInHistory);
            });
            if (inputBoxRef.current) {
                inputBoxRef.current.focus();
            }
        });
    }, [videoId]);

    useEffect(() => {
        if (closePlaylistEditForm) {
            onPlaylistEditComplete();
        }
    }, [closePlaylistEditForm]);

    const onDataInputChange = (playlistLabel) => {
        setPlaylistValue(playlistLabel);

        //ignore if present in existing tags
        if (usedPlaylists.find((item) => item.label === playlistLabel)) {
            setPlaylistSelectedFromExistingPlaylists(null);
            return;
        }

        const isFromUnusedPlaylists = unusedPlaylists.find((item) => item.label === playlistLabel);

        if (isFromUnusedPlaylists) {
            setPlaylistSelectedFromExistingPlaylists(true);
        } else if (playlistLabel.length > 2) {
            setPlaylistSelectedFromExistingPlaylists(false);
        } else {
            setPlaylistSelectedFromExistingPlaylists(null);
        }
    };

    const onPlaylistAddSuccess = (playlist) => {
        setPlaylistValue('');
        setUsedPlaylists([...usedPlaylists, playlist]);
        setUnusedPlaylists(unusedPlaylists.filter((item) => item.id != playlist.id));
        setLastUsedPlaylists(lastUsedPlaylists.filter((item) => item.id !== playlist.id));
        setMostUsedPlaylists(mostUsedPlaylists.filter((item) => item.id !== playlist.id));
    };

    const onPlaylistAdd = (playlistLabel) => {
        playlistLabel = playlistLabel.trim();
        const playlist = unusedPlaylists.find((item) => item.label === playlistLabel);
        const isDuplicate = usedPlaylists.find((item) => item.id === playlist.id);
        if (isDuplicate === undefined) {
            addVideoToPlaylist(videoId, playlist);
            onPlaylistAddSuccess(playlist);
        }
        setPlaylistValue('');
        if (inputBoxRef.current) {
            inputBoxRef.current.focus();
        }
    };

    const onPlaylistSelectedFromSuggestionList = (playlist, type) => {
        if (type === 'lastUsed') {
            const newLastusedPlaylist = lastUsedPlaylists.filter((item) => item.id != playlist.id);
            setLastUsedPlaylists(newLastusedPlaylist);
        } else if (type === 'mostUsed') {
            const newMostUsedPlaylist = mostUsedPlaylists.filter((item) => item.id != playlist.id);
            setMostUsedPlaylists(newMostUsedPlaylist);
        }
        onPlaylistAdd(playlist.label);
    };

    const onPlaylistRemoveFromUsed = (playlist) => {
        const updatedUsedPlaylists = usedPlaylists.filter((item) => item.id != playlist.id);
        setUsedPlaylists(updatedUsedPlaylists);

        setUnusedPlaylists([...unusedPlaylists, playlist]);
    };

    const onPlaylistRemove = (playlist) => {
        removeVideoFromPlaylist(videoId, playlist);
        onPlaylistRemoveFromUsed(playlist);
    };

    const onAddNewPlaylist = (playlistLabel) => {
        playlistLabel = playlistLabel.trim();
        const playlist = {
            label: playlistLabel,
            id: getUniqueID(),
        };
        addNewPlaylistToVideo(videoId, playlist);

        setUsedPlaylists([...usedPlaylists, playlist]);
        setPlaylistValue('');
        if (inputBoxRef.current) {
            inputBoxRef.current.focus();
        }
    };

    const onPlaylistEditComplete = () => {
        setPlaylistValue('');
        onPlaylistEditDone(usedPlaylists);
    };

    const onSelectChange = () => {
        if (playlistValue === '') {
            onPlaylistEditComplete();
            return;
        }
        if (isPlaylistSelectedFromExistingPlaylists === true) {
            onPlaylistAdd(playlistValue);
        } else if (isPlaylistSelectedFromExistingPlaylists === false) {
            onAddNewPlaylist(playlistValue);
        }
        setPlaylistValue('');
    };

    return (
        <div className={EditablePlaylistStyle.playListEditForm}>
            <h3>Edit playlists</h3>
            <div className={'secondaryInfo mt5'}>{videoTitle}</div>
            <div className={'mt5'}>
                {usedPlaylists.map((playlist) => (
                    <TagChip
                        isHighlighted={true}
                        label={playlist.label}
                        key={playlist.id}
                        editable={true}
                        onTagRemove={() => onPlaylistRemove(playlist)}
                    ></TagChip>
                ))}
            </div>
            <div className={formStyles.formSection}>
                {usedPlaylists.length < MAX_PLAYLISTS_PER_VIDEO && (
                    <DataInputList
                        inputList={unusedPlaylists}
                        value={playlistValue}
                        onChangeHandler={onDataInputChange}
                        placeholder="Search/Create a playlist"
                        onSelectChange={onSelectChange}
                        ref={inputBoxRef}
                    />
                )}

                {isPlaylistSelectedFromExistingPlaylists === true && playlistValue != '' && (
                    <Button type="primaryBtn" onClick={() => onPlaylistAdd(playlistValue)}>
                        Add playlist
                    </Button>
                )}
                {isPlaylistSelectedFromExistingPlaylists === false && playlistValue != '' && (
                    <Button type="primaryBtn" onClick={() => onAddNewPlaylist(playlistValue)}>
                        Create a new playlist
                    </Button>
                )}
                {usedPlaylists.length === MAX_PLAYLISTS_PER_VIDEO && (
                    <div>You reached maximum number of playlists for this video. Please delete few to add a new one.</div>
                )}
            </div>

            <div className={'mt15'}>
                {(lastUsedPlaylists.length > 0 || mostUsedPlaylists > 0) && <div>You may choose</div>}
                <div className={'mt15'}>
                    {lastUsedPlaylists.map((playlist) => (
                        <TagChip
                            label={playlist.label}
                            key={playlist.id}
                            type={'history'}
                            isSelectable={true}
                            onSelection={() => {
                                onPlaylistSelectedFromSuggestionList(playlist, 'lastUsed');
                            }}
                        ></TagChip>
                    ))}
                    {mostUsedPlaylists.map((playlist) => (
                        <TagChip
                            label={playlist.label}
                            key={playlist.id}
                            isSelectable={true}
                            onSelection={() => {
                                onPlaylistSelectedFromSuggestionList(playlist, 'mostUsed');
                            }}
                        ></TagChip>
                    ))}
                </div>
            </div>
            <ModalActionFooter>
                <Button type="primaryBtn" onClick={() => onPlaylistEditComplete()}>
                    Done
                </Button>
            </ModalActionFooter>
        </div>
    );
};

export default PlaylistEditForm;
