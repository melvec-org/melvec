import React, { useEffect, useState } from 'react';
import Video from '../../../components/core-components/video/Video';
import styles from './FeaturedPlayer.css';
import Header from '../../../components/core-components/header/Header';
import TagChip from '__components/editable-tag-list/TagChip';
import { useApplicationContext } from '__contexts/app.context';

//debounce function
const debounce = (func, delay) => {
    let debounceTimer;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    };
};

const FeaturedPlayer = ({ videoInfo = { path: '', id: '', isNsfw: false }, onPlayEnd }) => {
    const [stateContext] = useApplicationContext();
    const playerWrapperRef = React.useRef(null);
    const [maxVideoContainerWidth, setMaxVideoContainerWidth] = useState('auto');

    useEffect(() => {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: videoInfo.name,
            album: videoInfo.coll,
        });
    }, [videoInfo]);

    const handleResize = (videoWidth, videoHeight) => {
        const scaleFactor = 1.25;

        const contentWidth = videoWidth;
        const contentHeight = videoHeight;

        const videoMaxWidth = contentWidth * scaleFactor;
        const videoMaxHeight = contentHeight * scaleFactor;
        const containerWidth = playerWrapperRef.current.getBoundingClientRect().width;
        const containerHeight = playerWrapperRef.current.getBoundingClientRect().height;

        if (containerWidth > videoMaxWidth) {
            setMaxVideoContainerWidth(videoMaxWidth);
        } else {
            setMaxVideoContainerWidth(containerWidth);
        }
    };

    const onMetaDataFound = (data) => {
        handleResize(data.videoWidth, data.videoHeight);
    };

    return (
        <div className={styles.featuredPlayer}>
            <div className={styles.videoWrapper} ref={playerWrapperRef}>
                <div style={{ maxWidth: `${maxVideoContainerWidth}px` }}>
                    <Video
                        src={videoInfo.path}
                        videoId={videoInfo.id}
                        autoPlay={true}
                        id="featured-video-player"
                        onPlayEnd={onPlayEnd}
                        onMetaDataFound={onMetaDataFound}
                        isNsfw={Boolean(videoInfo.isNsfw)}
                        hideNsfwContent={Boolean(stateContext?.userPreferences?.hideNsfwContent)}
                    />
                </div>
            </div>

            <Header type={'mediaLargeTitle'}>{videoInfo.name}</Header>
            <div className={styles.metaDataSection}>
                <div className={styles.metaDataLabel}>Views :</div>
                <div>{videoInfo.views}</div>
                <div className={styles.metaDataLabel}>Collection : </div>
                <div>{videoInfo.collection}</div>
                {videoInfo.playlists[0] && (
                    <>
                        <div className={styles.metaDataLabel}>Playlists :</div>

                        <div className={styles.videoMetaData}>
                            {videoInfo.playlists[0] &&
                                videoInfo.playlists.map((item) => {
                                    return <TagChip key={item.id} label={item.label} id={item.id} />;
                                })}
                        </div>
                    </>
                )}
                {videoInfo.tags[0] && (
                    <>
                        <div className={styles.metaDataLabel}>Tags :</div>
                        <div>{videoInfo.tags[0] && videoInfo.tags.map((tag) => <TagChip label={tag.label} key={tag.id}></TagChip>)}</div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FeaturedPlayer;
