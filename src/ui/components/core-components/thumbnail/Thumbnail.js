import React, { useEffect, useRef, useState } from 'react';
import style from './Thumbnail.css';
import { registerThumbnailListener, unregisterThumbnailListener } from '__utils/thumbnailListenerRegistry';
import mediaTypes from '__constants/mediaTypes';

/**
 * image thumbnail. No events here to make things faster
 * @param url
 * @param variant
 */
const PREVIEW_HOVER_DELAY_MS = 500;

const Thumbnail = ({
    url,
    variant = 'large',
    onError,
    isNsfw = false,
    hideNsfwContent = false,
    mediaType = mediaTypes.VIDEO,
    previewPath = null,
    showVideoPreviewOnHover = false,
    previewHoverDelayMs = PREVIEW_HOVER_DELAY_MS,
}) => {
    const [isThumbnailAvailable, setIsThumbnailAvailable] = useState(true);
    const [isHovered, setIsHovered] = useState(false);
    const [isPreviewAvailable, setIsPreviewAvailable] = useState(true);
    const videoRef = useRef(null);
    const hoverTimerRef = useRef(null);

    const variantClassDict = {
        small: `${style.thumbnailSmall}`,
        large: `${style.thumbnail}`,
        xs: `${style.thumbnailXS}`,
    };

    useEffect(() => {
        if (!isThumbnailAvailable) {
            registerThumbnailListener(url, () => {
                setIsThumbnailAvailable(true);
            });
        }
        return () => {
            unregisterThumbnailListener(url);
        };
    }, [isThumbnailAvailable, url]);

    const [isVideoReady, setIsVideoReady] = useState(false);

    const onMouseEnter = () => {
        if (!canShowPreview) return;
        hoverTimerRef.current = setTimeout(() => setIsHovered(true), previewHoverDelayMs);
    };

    const onMouseLeave = () => {
        clearTimeout(hoverTimerRef.current);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
        setIsVideoReady(false);
        setIsHovered(false);
    };

    const onVideoCanPlay = () => {
        setIsVideoReady(true);
        videoRef.current?.play().catch(() => {});
    };

    const onImageLoadError = () => {
        setIsThumbnailAvailable(false);
        if (typeof onError === 'function') onError();
    };

    const shouldHideThumbnail = Boolean(isNsfw && hideNsfwContent);
    const canShowPreview = showVideoPreviewOnHover && Boolean(previewPath) && !shouldHideThumbnail && isPreviewAvailable;

    const wrapperClassName = shouldHideThumbnail ? `${variantClassDict[variant]} ${style.hiddenNsfwThumbnail}` : variantClassDict[variant];
    const imageClassName = shouldHideThumbnail ? `${style.thumbnailImage} ${style.blurredThumbnailImage}` : style.thumbnailImage;

    if (mediaType !== mediaTypes.AUDIO) {
        return (
            <div className={wrapperClassName} data-url={url} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                {isThumbnailAvailable && <img src={url} className={`${imageClassName}`} alt="none" onError={() => onImageLoadError()} />}
                {!isThumbnailAvailable && <div className={style.thumbnailImagePlaceholder}>&#9658;</div>}
                {canShowPreview && isHovered && (
                    <video
                        ref={videoRef}
                        src={previewPath}
                        className={`${imageClassName} ${style.previewLayer}`}
                        style={{ opacity: isVideoReady ? 1 : 0 }}
                        muted
                        playsInline
                        onCanPlay={onVideoCanPlay}
                        onError={() => setIsPreviewAvailable(false)}
                    />
                )}
            </div>
        );
    } else {
        return (
            <div className={wrapperClassName}>
                <div className={style.audioThumbnail}></div>
            </div>
        );
    }
};

export default Thumbnail;
