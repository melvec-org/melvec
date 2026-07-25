import React, { useEffect, useState } from 'react';
import PlaylistDetailsPanel from '../../../components/playlist-details-panel/PlaylistDetailsPanel';
import { useApplicationContext } from '__contexts/app.context';
import applicationEvents from '__events/applicationEvents';
import responseStatus from '__constants/responseStatus';

const UserPlaylistVideos = ({ playlistId = '', playlistLabel = '' }) => {
    const [playlistDetails, setPlaylistDetails] = useState([]);
    const [, dispatchContext] = useApplicationContext();

    useEffect(() => {
        window.api.getPlaylistDetails(playlistId).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setPlaylistDetails(response.data);
            } else {
                alert('Failed to get playlist details.', response.message);
                setPlaylistDetails([]);
            }
        });
    }, [playlistId]);

    const onPlaylistItemClick = (item) => {
        if (item && playlistDetails[0]) {
            dispatchContext({
                type: applicationEvents.PLAY_VIDEO_FROM_PLAYLIST,
                payload: {
                    currentPlaylist: playlistDetails,
                    currentPlayItem: item,
                    currentPlaylistName: playlistLabel,
                },
            });
        }
    };

    return (
        <PlaylistDetailsPanel
            title={playlistLabel}
            playlistId={playlistId}
            playlistItems={playlistDetails}
            isUserCurrated={true}
            isEditable={true}
            onPlaylistItemClick={onPlaylistItemClick}
        />
    );
};

export default UserPlaylistVideos;
