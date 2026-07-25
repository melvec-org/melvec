import React, { useEffect } from 'react';
import PlaylistDetailsPanel from '__components/playlist-details-panel/PlaylistDetailsPanel';
import useSmartPlaylistAction from '../useSmartPlaylistAction';

const RecentlyPlayedVideos = () => {
    const { recentlyPlayedVideos, getRecentlyPlayedVideos, playFromSmartPlaylist } = useSmartPlaylistAction();

    useEffect(() => {
        getRecentlyPlayedVideos();
    }, []);

    const onPlaylistItemClick = (item) => playFromSmartPlaylist(recentlyPlayedVideos, item, 'Recently played playlist');

    return (
        <PlaylistDetailsPanel
            title={'Recently played videos'}
            playlistItems={recentlyPlayedVideos}
            onPlaylistItemClick={onPlaylistItemClick}
        />
    );
};
export default RecentlyPlayedVideos;
