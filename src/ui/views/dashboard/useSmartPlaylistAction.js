import { useApplicationContext } from '__contexts/app.context';
import { useState } from 'react';
import applicationEvents from '__events/applicationEvents';
import responseStatus from '__constants/responseStatus';

const useSmartPlaylistAction = () => {
    const [leastPlayedVideos, setLeastPlayedVideos] = useState([]);
    const [mostPlayedVideos, setMostPlayedVideos] = useState([]);
    const [mostSearchedVideos, setMostSearchedVideos] = useState([]);
    const [newlyAddedVideos, setNewlyAddedVideos] = useState([]);
    const [recentlyPlayedVideos, setRecentlyPlayedVideos] = useState([]);
    const [topRatedVideos, setTopRatedVideos] = useState([]);
    const [echoesVideos, setEchoesVideos] = useState([]);

    const [, dispatchContext] = useApplicationContext();

    const getNewlyAddedVideos = () => {
        window.api.getNewlyAddedVideosSmartList().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setNewlyAddedVideos(response.data);
            }
        });
    };

    const getLeastPlayedVideos = () => {
        window.api.getLeastPlayedVideosSmartList().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setLeastPlayedVideos(response.data);
            }
        });
    };

    const getMostPlayedVideos = () => {
        window.api.getMostPlayedVideosSmartList().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setMostPlayedVideos(response.data);
            }
        });
    };

    const getMostSearchedVideos = () => {
        window.api.getMostSearchedVideosSmartList().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setMostSearchedVideos(response.data);
            }
        });
    };

    const getRecentlyPlayedVideos = () => {
        window.api.getRecentlyPlayedVideosSmartList().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setRecentlyPlayedVideos(response.data);
            }
        });
    };

    const getTopRatedVideos = () => {
        window.api.getTopRatedVideosSmartList().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setTopRatedVideos(response.data);
            }
        });
    };

    const getEchoesVideos = () => {
        window.api.getEchoesSmartList().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setEchoesVideos(response.data);
            }
        });
    };

    const playFromSmartPlaylist = (currentPlaylist, currentPlayItem, currentPlaylistName) => {
        if (currentPlayItem && currentPlaylist[0]) {
            dispatchContext({
                type: applicationEvents.PLAY_VIDEO_FROM_PLAYLIST,
                payload: { currentPlaylist, currentPlayItem, currentPlaylistName: currentPlaylistName },
            });
        }
    };

    return {
        leastPlayedVideos,
        mostPlayedVideos,
        mostSearchedVideos,
        newlyAddedVideos,
        recentlyPlayedVideos,
        topRatedVideos,
        echoesVideos,
        getNewlyAddedVideos,
        getLeastPlayedVideos,
        getMostPlayedVideos,
        getMostSearchedVideos,
        getRecentlyPlayedVideos,
        getTopRatedVideos,
        getEchoesVideos,
        playFromSmartPlaylist,
    };
};

export default useSmartPlaylistAction;
