import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import style from './Video.css';
import Button from '../button/Button';

const Video = forwardRef(
    (
        {
            src = '',
            autoPlay = false,
            onMetaDataFound = null,
            videoId,
            id,
            onPlayEnd,
            isExternal = false,
            onLoadError,
            isNsfw = false,
            hideNsfwContent = false,
        },
        ref,
    ) => {
        const [isViewed, setIsViewed] = useState(false);
        const [isRevealed, setIsRevealed] = useState(false);
        const videoRef = useRef(null);

        const shouldHideVideo = Boolean(isNsfw && hideNsfwContent && !isRevealed);

        const onPlaying = () => {
            if (shouldHideVideo && videoRef.current) {
                videoRef.current.pause();
                return;
            }

            if (isViewed === false) {
                setIsViewed(true);
                if (!isExternal) {
                    window.api.increaseVideoViewCount(videoId);
                }
            }
        };

        useImperativeHandle(ref, () => ({
            play: () => {
                if (!shouldHideVideo && videoRef.current) {
                    videoRef.current.play();
                }
            },
            pause: () => videoRef.current.pause(),
            stop: () => videoRef.current.pause(),
            reveal: () => setIsRevealed(true),
            element: videoRef.current,
        }));

        useEffect(() => {
            if (!videoRef.current) return;

            if (autoPlay && !shouldHideVideo) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }, [autoPlay, shouldHideVideo]);

        useEffect(() => {
            if (!navigator.mediaSession) return;

            navigator.mediaSession.setActionHandler('play', () => {
                if (!shouldHideVideo && videoRef.current) {
                    videoRef.current.play();
                }
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                if (videoRef.current) {
                    videoRef.current.pause();
                }
            });
        }, [shouldHideVideo]);

        useEffect(() => {
            if (src) {
                setIsViewed(false);
                setIsRevealed(false);
            }
        }, [src]);

        const handleVideoError = (e) => {
            if (e.target.error.code === e.target.error.MEDIA_ERR_NETWORK || e.target.error.code === 4) {
                onLoadError && onLoadError();
            }
        };

        const onVideoMetaData = (e) => {
            onMetaDataFound &&
                onMetaDataFound({
                    videoWidth: e.target.videoWidth,
                    videoHeight: e.target.videoHeight,
                    duration: e.target.duration,
                });
        };

        const handlePlay = () => {
            if (shouldHideVideo && videoRef.current) {
                videoRef.current.pause();
                return;
            }

            if (navigator.mediaSession) {
                navigator.mediaSession.playbackState = 'playing';
            }
        };

        const handlePause = () => {
            if (navigator.mediaSession) {
                navigator.mediaSession.playbackState = 'paused';
            }
        };

        const handleReveal = (event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsRevealed(true);
        };

        const handleOverlayContextMenu = (event) => {
            event.preventDefault();
            event.stopPropagation();
        };

        const wrapperClassName = shouldHideVideo ? `${style.videoWrapper} ${style.hiddenNsfw}` : style.videoWrapper;
        const videoClassName = shouldHideVideo
            ? `${style.video} ${style.blurredVideo} ${id === 'featured-video-player' ? style.featuredBlurredVideo : ''}`
            : style.video;

        return (
            <div className={wrapperClassName}>
                <video
                    src={src}
                    width="100%"
                    controls={!shouldHideVideo}
                    autoPlay={!shouldHideVideo && autoPlay}
                    onPlaying={onPlaying}
                    onLoadedMetadata={onVideoMetaData}
                    onEnded={() => onPlayEnd && onPlayEnd(videoId)}
                    id={id}
                    ref={videoRef}
                    onError={handleVideoError}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    className={videoClassName}
                />
                {shouldHideVideo && (
                    <div className={style.hiddenNsfwOverlay} onContextMenu={handleOverlayContextMenu}>
                        <div className={style.hiddenNsfwOverlayContent}>
                            <div className={style.hiddenNsfwLabel}>Sensitive content hidden</div>
                            <Button type="button" className={style.revealButton} onClick={handleReveal}>
                                Reveal video
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    },
);

export default Video;
