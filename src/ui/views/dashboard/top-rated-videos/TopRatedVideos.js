import React, { useEffect } from 'react';
import PlaylistDetailsPanel from '../../../components/playlist-details-panel/PlaylistDetailsPanel';
import useSmartPlaylistAction from '../useSmartPlaylistAction';

const TopRatedVideos = () => {
    const { topRatedVideos, getTopRatedVideos, playFromSmartPlaylist } = useSmartPlaylistAction();

    useEffect(() => {
        getTopRatedVideos();
    }, []);

    const onPlaylistItemClick = (item) => playFromSmartPlaylist(topRatedVideos, item, 'Top rated playlist');

    return (
        <PlaylistDetailsPanel
            title={'Top rated Videos'}
            playlistItems={topRatedVideos}
            onPlaylistItemClick={onPlaylistItemClick}
            fallbackMessage="Please rate the videos to see this list populated."
        />
    );
};
export default TopRatedVideos;
