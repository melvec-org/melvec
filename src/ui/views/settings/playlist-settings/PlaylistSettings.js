import React, { useEffect, useState } from 'react';
import EditableList from '__components/editable-list/EditableList';

import { useApplicationContext } from '__contexts/app.context';

import {
    HeaderControlBar,
    HeaderControlBarRight,
    HeaderControlBarLeft,
} from '__components/core-components/header-control-bar/HeaderControlBar';
import InputFilter from '__components/core-components/input-filter/InputFilter';
import SortingSelector from '__components/core-components/sorting-selector/SortingSelector';
import Button from '__components/core-components/button/Button';

import settingsStyle from '../Settings.css';
import AddNewPlaylist from '__components/add-playlist/AddNewPlaylist';
import cloneDeep from '__utils/cloneDeep';
import PlaylistEditor from '__components/playlist-editor/PlaylistEditor';
import usePlaylistActions from '../../../actions/usePlaylistActions';
import sortBy from '__utils/sortBy';

const PlaylistSettings = () => {
    const [stateContext] = useApplicationContext();
    const [playlists, setPlaylists] = useState(stateContext.playlists || []);
    const [sortingOrder, setSortingOrder] = useState('recent_asc');
    const [textToFilter, setTextToFilter] = useState('');
    const [openNewPlaylist, setOpenNewPlaylist] = useState(false);
    const [playlistToEdit, setPlaylistToEdit] = useState(null);
    const { removePlaylist } = usePlaylistActions();

    const onItemRemove = (item) => {
        window.confirm(`Are you sure you want to remove "${item.label}" playlist?`) && removePlaylist(item);
    };

    const onTextFilter = (str) => setTextToFilter(str);

    const onSortingChange = (order) => setSortingOrder(order);

    useEffect(() => {
        let playlistsToBeShown = cloneDeep(stateContext.playlists);

        if (textToFilter !== '') {
            playlistsToBeShown = playlistsToBeShown.filter((item) => item.label.includes(textToFilter));
        }
        if (sortingOrder === 'A-Z') {
            setPlaylists(sortBy(playlistsToBeShown, 'label'));
        }
        if (sortingOrder === 'Z-A') {
            setPlaylists(sortBy(playlistsToBeShown, 'label').reverse());
        }
        if (sortingOrder === 'recent_asc') {
            setPlaylists(playlistsToBeShown);
        }
        if (sortingOrder === 'recent_desc') {
            setPlaylists(playlistsToBeShown.reverse());
        }
    }, [sortingOrder, textToFilter, stateContext.playlists]);

    const onNewPlaylistAdded = (newPlaylistName) => {
        if (newPlaylistName == null) {
            setOpenNewPlaylist(false);
        }
    };

    return (
        <div>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3 title="These are custom playlists">Your playlists</h3>
                </HeaderControlBarLeft>
                <HeaderControlBarRight>
                    <InputFilter onChange={onTextFilter} />
                    <SortingSelector
                        options={[
                            { value: 'A-Z', label: 'A-Z' },
                            { value: 'Z-A', label: 'Z-A' },
                            { value: 'recent_asc', label: 'Recent first' },
                            { value: 'recent_desc', label: 'Recent last' },
                        ]}
                        placeholder={'Sort playlists'}
                        onChange={onSortingChange}
                    ></SortingSelector>
                </HeaderControlBarRight>
            </HeaderControlBar>

            <EditableList
                list={playlists}
                removeHandler={onItemRemove}
                editHandler={(item) => setPlaylistToEdit(item)}
            />
            <div className={settingsStyle.settingsFooterActions}>
                <Button onClick={() => setOpenNewPlaylist(true)}>Add new playlist</Button>
                {openNewPlaylist && <AddNewPlaylist onPlaylistAdd={onNewPlaylistAdded} playlists={playlists} />}
            </div>
            {playlistToEdit && (
                <PlaylistEditor
                    playlist={playlistToEdit}
                    playlistsList={playlists}
                    onEditDone={() => setPlaylistToEdit(null)}
                />
            )}
        </div>
    );
};
export default PlaylistSettings;
