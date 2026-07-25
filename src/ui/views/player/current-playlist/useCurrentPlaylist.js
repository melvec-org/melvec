import { useApplicationContext } from '__contexts/app.context';

import { useEffect, useState } from 'react';

const useCurrentPlaylist = () => {
    const [stateContext, dispatchContext] = useApplicationContext();

    const [playlist, setPlaylist] = useState(stateContext.currentPlaylist);

    const [videoDetailsObj, setVideoDetailsObject] = useState(null);
    // this is to fetch all the relatedPlaylist and display them if required.

    const [playlistControls, setPlaylistControls] = useState({ autoPlay: true, shuffle: true, repeat: true });

    const changeControlsData = (attribute, value) => {
        const attributesDict = {
            autoPlay: 'isPlaylistAutoPlay',
            shuffle: 'isPlaylistShuffle',
            repeat: 'isPlaylistRepeatPlay',
        };
        window.api.setApplicationSettings(attributesDict[attribute], value);
        setPlaylistControls({ ...playlistControls, [attribute]: value });
    };

    useEffect(() => {
        let newPlaylistControl = {};
        window.api.getApplicationSettings('isPlaylistShuffle').then((data) => {
            newPlaylistControl.shuffle = data;
            window.api.getApplicationSettings('isPlaylistAutoPlay').then((data) => {
                newPlaylistControl.autoPlay = data;
                window.api.getApplicationSettings('isPlaylistRepeatPlay').then((data) => {
                    newPlaylistControl.repeat = data;
                    setPlaylistControls(newPlaylistControl);
                });
            });
        });
    }, []);

    useEffect(() => {
        if (stateContext.currentPlaybackVideo) {
            const videoInfo = stateContext.currentPlaybackVideo || { id: null };
            window.api.getFullVideoDetails(videoInfo.id).then((details) => {
                details.path = stateContext.userPreferences.libraryPath + '/' + details.path;
                setVideoDetailsObject(details);
            });
        }
    }, [stateContext.currentPlaybackVideo]);

    /**
     * 
     *  // If autoPlay is enabled, fetch the next video id and play it.
            
            // else play the next item in the playlist
            // find the index of current video first
            // if if playlistControls.shuffle true, then find any random video except for the current video and set the details as videoDetailsObject
            // then get the next item in the playlist
            // if current video is the last item in the list, then check for playlistContext.repeat status
            // if repeat is enabled, play the first video of the playlist again
            
            // else play the next item in the playlist
           
     * @param {*} videoId 
     */
    const playNextItem = (videoId) => {
        if (playlistControls.autoPlay) {
            const currentIndex = playlist.findIndex((item) => item.id === videoId);
            if (playlistControls.shuffle) {
                const randomIndex = Math.floor(Math.random() * playlist.length);
                if (randomIndex !== currentIndex) {
                } else {
                }
            } else {
                const nextIndex = (currentIndex + 1) % playlist.length;
                dispatchContext({ type: 'playVideo', payload: playlist[nextIndex] });
            }
        }
        // Implement logic to play next item in the playlist
    };

    const playPreviousItem = (videoId) => {
        if (playlistControls.autoPlay) {
            const currentIndex = playlist.findIndex((item) => item.id === videoId);
            if (playlistControls.shuffle) {
                const randomIndex = Math.floor(Math.random() * playlist.length);
                if (randomIndex !== currentIndex) {
                } else {
                }
            } else {
                const previousIndex = (currentIndex - 1 + playlist.length) % playlist.length;
                dispatchContext({ type: 'playVideo', payload: playlist[previousIndex] });
            }
        }
        // Implement logic to play previous item in the playlist
    };

    useEffect(() => {
        // Update the playlist whenever the current playlist changes
        if (stateContext.currentPlaylist) {
            setPlaylist(stateContext.currentPlaylist);
        }
    }, [stateContext.currentPlaylist]);

    return {
        currentPlaylist: playlist,
        currentPlayingVideoDetails: videoDetailsObj,
        playNextItem,
        playlistControlsData: playlistControls,
        changeControlsData,
        currentPlaylistName: stateContext.currentPlaylistName,
    };
};

export default useCurrentPlaylist;
