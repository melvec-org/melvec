import React, { useEffect } from 'react';
import PlaylistDetailsPanel from '../../../components/playlist-details-panel/PlaylistDetailsPanel';
import useSmartPlaylistAction from '../useSmartPlaylistAction';

const NewlyAddedVideos = () => {
    const { newlyAddedVideos, getNewlyAddedVideos, playFromSmartPlaylist } = useSmartPlaylistAction();

    useEffect(() => {
        getNewlyAddedVideos();
    }, []);

    const onPlaylistItemClick = (item) => {
        playFromSmartPlaylist(newlyAddedVideos, item, 'Newly added playlist');
    };

    return (
        <PlaylistDetailsPanel
            title={'Newly added videos'}
            playlistItems={newlyAddedVideos}
            onPlaylistItemClick={onPlaylistItemClick}
            fallbackMessage="Please add some videos to see this list"
        />
    );
};
export default NewlyAddedVideos;
