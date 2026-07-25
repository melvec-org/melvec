import React, { useEffect, useState } from 'react';
import PlaylistDetailsPanel from '__components/playlist-details-panel/PlaylistDetailsPanel';
import useSmartPlaylistAction from '../useSmartPlaylistAction';
const MostSearchedVideos = () => {
    const { mostSearchedVideos, getMostSearchedVideos, playFromSmartPlaylist } = useSmartPlaylistAction();

    useEffect(() => {
        getMostSearchedVideos();
    }, []);

    const onPlaylistItemClick = (item) => playFromSmartPlaylist(mostSearchedVideos, item, 'Most searched playlist');

    return (
        <PlaylistDetailsPanel
            title="Most searched Videos"
            playlistItems={mostSearchedVideos}
            onPlaylistItemClick={onPlaylistItemClick}
            fallbackMessage="This list will only be populated if you have searched something in the past."
        />
    );
};

export default MostSearchedVideos;
