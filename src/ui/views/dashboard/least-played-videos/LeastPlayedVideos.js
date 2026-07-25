import React, { useEffect, useState } from 'react';
import PlaylistDetailsPanel from '__components/playlist-details-panel/PlaylistDetailsPanel';
import useSmartPlaylistAction from '../useSmartPlaylistAction';

const LeastPlayedVideos = () => {
    const { leastPlayedVideos, getLeastPlayedVideos, playFromSmartPlaylist } = useSmartPlaylistAction();

    useEffect(() => {
        getLeastPlayedVideos();
    }, []);

    const onPlaylistItemClick = (item) => {
        playFromSmartPlaylist(leastPlayedVideos, item, 'Least played playlist');
    };

    return (
        <PlaylistDetailsPanel title={'Least played videos'} playlistItems={leastPlayedVideos} onPlaylistItemClick={onPlaylistItemClick} />
    );
};
export default LeastPlayedVideos;
