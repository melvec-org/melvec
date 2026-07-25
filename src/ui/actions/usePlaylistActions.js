// this is an action hook, that will control all the event actions of modifying the actions

import { useEffect, useState } from 'react';

import { useApplicationContext } from '__contexts/app.context';
import mainThreadEvents from '__events/mainThreadEvents';

const usePlaylistActions = () => {
    const [stateContext, dispatchContext] = useApplicationContext();
    const [playlists, setPlaylists] = useState([]);

    /**
     * Add playlist is fired to add a new item to the playlist
     * @param {*} playlist
     */
    const addNewPlaylist = (playlist) => {
        window.api.addNewPlaylist(playlist).then((response) => {
            if (response?.status == 'success') {
                dispatchContext({ type: mainThreadEvents.ON_PLAYLIST_UPDATE, payload: { playlists: response.data } });
            } else {
                alert('Failed to add playlist', response.message);
            }
        });
    };

    /**
     * Remove playlist is fired to remove an item from the playlist
     * @param {*} playlistId
     */
    const removePlaylist = (playlist) => {
        window.api.removePlaylist(playlist).then((response) => {
            if (response?.status == 'success') {
                dispatchContext({ type: mainThreadEvents.ON_PLAYLIST_UPDATE, payload: { playlists: response.data } });
            } else {
                alert('Failed to remove playlist.', response.message);
            }
        });
    };

    /**
     * Rename playlist is fired to rename an item in the playlist
     * @param {*} playlistId
     * @param {*} newName
     */
    const renamePlaylist = (playlistId, newName) => {
        window.api.renamePlaylist(playlistId, newName).then((response) => {
            if (response?.status == 'success') {
                dispatchContext({ type: mainThreadEvents.ON_PLAYLIST_UPDATE, payload: { playlists: response.data } });
            } else {
                alert('Failed to rename playlist.', response.message);
            }
        });
    };

    useEffect(() => {
        setPlaylists(stateContext.playlists);
    }, [stateContext.playlists]);

    return {
        addNewPlaylist,
        removePlaylist,
        renamePlaylist,
        playlists,
    };
};

export default usePlaylistActions;
