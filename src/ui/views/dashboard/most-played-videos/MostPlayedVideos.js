import React, { useEffect } from 'react';
import PlaylistDetailsPanel from '__components/playlist-details-panel/PlaylistDetailsPanel';
import useSmartPlaylistAction from '../useSmartPlaylistAction';

const MostPlayedVideos = () => {
    const { mostPlayedVideos, getMostPlayedVideos, playFromSmartPlaylist } = useSmartPlaylistAction();

    useEffect(() => {
        getMostPlayedVideos();
    }, []);

    const onPlaylistItemClick = (item) => playFromSmartPlaylist(mostPlayedVideos, item, 'Most played playlist');
    return (
        <PlaylistDetailsPanel
            title={'Most played videos'}
            playlistItems={mostPlayedVideos}
            onPlaylistItemClick={onPlaylistItemClick}
            fallbackMessage="You need to play few videos to see this list"
        />
    );
};
export default MostPlayedVideos;
