import React, { useEffect, useState } from 'react';
import PlaylistDetailsPanel from '__components/playlist-details-panel/PlaylistDetailsPanel';
import useSmartPlaylistAction from '../useSmartPlaylistAction';

const EchoesVideos = () => {
    const { echoesVideos, getEchoesVideos, playFromSmartPlaylist } = useSmartPlaylistAction();

    useEffect(() => {
        getEchoesVideos();
    }, []);

    const onPlaylistItemClick = (item) => {
        const year = new Date(item.birthtimeMs).getFullYear();
        const videoList = echoesVideos.filter((list) => list.year === year)[0].videos;
        playFromSmartPlaylist(videoList, item, `Echoes from year ${year}`);
    };

    return (
        <>
            {echoesVideos.length > 0 &&
                echoesVideos.map((list) => {
                    return (
                        <PlaylistDetailsPanel
                            key={'echoes_${list.year}'}
                            title={` Echoes from year ${list.year}`}
                            playlistItems={list.videos}
                            onPlaylistItemClick={onPlaylistItemClick}
                        />
                    );
                })}
        </>
    );
};
export default EchoesVideos;
