import React, { useEffect, useState } from 'react';
import HorizontalPlaylist from '__components/horizontal-playlist/HorizontalPlaylist';
import { useApplicationContext } from '../../../contexts/app.context';
import applicationEvents from '__events/applicationEvents';

const RelatedVideos = ({ targetVideoId = null }) => {
    const [, dispatchContext] = useApplicationContext();
    const [relatedVideosList, setRelatedVideosList] = useState([]);

    useEffect(() => {
        if (targetVideoId) {
            window.api.getRelatedVideos(targetVideoId).then((relatedVideos) => {
                setRelatedVideosList(relatedVideos);
            });
        }
    }, [targetVideoId]);

    const onPlaylistItemClick = (item) => {
        dispatchContext({
            type: applicationEvents.PLAY_VIDEO_FROM_PLAYLIST,
            payload: { currentPlaylist: relatedVideosList, currentPlayItem: item },
        });
    };

    if (relatedVideosList.length > 0) {
        return (
            <div>
                {relatedVideosList[0] && (
                    <HorizontalPlaylist
                        title={'Related videos'}
                        playlist={relatedVideosList}
                        onPlaylistItemClick={onPlaylistItemClick}
                    />
                )}
            </div>
        );
    } else {
        return null;
    }
};

export default RelatedVideos;
