import React, { useEffect, useState } from 'react';
import PlaylistDetailsPanel from '../../../components/playlist-details-panel/PlaylistDetailsPanel';
import { useApplicationContext } from '__contexts/app.context';
import applicationEvents from '__events/applicationEvents';
import responseStatus from '__constants/responseStatus';

const TopTagsPlaylistVideos = ({ tagId = '', tagLabel = '' }) => {
    const [playlistDetails, setPlaylistDetails] = useState([]);
    const [, dispatchContext] = useApplicationContext();
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        window.api.getTopTagPlaylistDetails(tagId).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setPlaylistDetails(response.data);
            } else {
                setFetchError(response.message);
            }
        });
    }, [tagId]);

    const onPlaylistItemClick = (currentPlayItem) => {
        if (currentPlayItem && playlistDetails[0]) {
            dispatchContext({
                type: applicationEvents.PLAY_VIDEO_FROM_PLAYLIST,
                payload: { currentPlaylist: playlistDetails, currentPlayItem, currentPlaylistName: 'Top tags' },
            });
        }
    };

    if (playlistDetails && playlistDetails.length > 0) {
        return <PlaylistDetailsPanel title={tagLabel} playlistItems={playlistDetails} onPlaylistItemClick={onPlaylistItemClick} />;
    } else {
        return (
            <div className="center">
                <div className="textCenter genericMessageBox">
                    <div className="genericMessage">{fetchError}</div>
                </div>
            </div>
        );
    }
};

export default TopTagsPlaylistVideos;
