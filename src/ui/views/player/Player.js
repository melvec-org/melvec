import React, { useState, useEffect } from 'react';
import PlayerLayout from '../../components/layouts/PlayerLayout';
import FeaturedPlayer from './featured-player/FeaturedPlayer';
import MainPanel from '../../components/layouts/MainPanel';
import Sidebar from '../../components/layouts/Sidebar';
import CurrentPlaylist from './current-playlist/CurrentPlaylist';
import RelatedVideos from './related-videos/RelatedVideos';
import IconButton from '__components/core-components/icon-button/IconButton';

import useCurrentPlaylist from './current-playlist/useCurrentPlaylist';
import { PlaylistProvider } from '__contexts/playlist.context';
import styles from './Player.css';
import ResizableSidePanel from '__components/resizable-panel/ResizableSidePanel';

const PlaylistControls = ({ controlsData, changeControlsData }) => {
    return (
        <>
            <IconButton
                icon={'autoPlay'}
                title="Auto Play"
                isSelected={controlsData.autoPlay}
                _classes={styles.groupIconButton}
                onClick={() => changeControlsData('autoPlay', !controlsData.autoPlay)}
            />
            <IconButton
                icon={'repeatPlay'}
                title="Repeat"
                _classes={styles.groupIconButton}
                isSelected={controlsData.repeat}
                onClick={() => changeControlsData('repeat', !controlsData.repeat)}
            />
            <IconButton
                icon={'shuffle'}
                isSelected={controlsData.isSuffle}
                title="Suffle playlist"
                _classes={styles.groupIconButton}
                onClick={() => changeControlsData('shuffle', !controlsData.isShuffle)}
            />
        </>
    );
};

const PlayerContent = () => {
    const {
        currentPlaylist,
        currentPlayingVideoDetails,
        currentPlaylistName,
        playNextItem,

        playlistControlsData,
        changeControlsData,
    } = useCurrentPlaylist();

    const onPlayEnd = (id) => {
        playNextItem(id);
    };

    return (
        <>
            <MainPanel>
                {currentPlayingVideoDetails && (
                    <>
                        <FeaturedPlayer videoInfo={currentPlayingVideoDetails} onPlayEnd={onPlayEnd} />
                        <RelatedVideos targetVideoId={currentPlayingVideoDetails.id} />
                    </>
                )}
            </MainPanel>
            {currentPlaylist && (
                <ResizableSidePanel maxWidth={450} minWidth={300} initialWidth={340} direction="left" panelId="playlistsSidebar">
                    <Sidebar
                        variant="large"
                        headerLabel={currentPlaylistName}
                        headerControls={<PlaylistControls controlsData={playlistControlsData} changeControlsData={changeControlsData} />}
                    >
                        <CurrentPlaylist playlist={currentPlaylist} selectedItem={currentPlayingVideoDetails} />
                    </Sidebar>
                </ResizableSidePanel>
            )}
        </>
    );
};

const Player = () => {
    return (
        <PlayerLayout>
            <PlaylistProvider initialState={{}}>
                <PlayerContent />
            </PlaylistProvider>
        </PlayerLayout>
    );
};

export default Player;
