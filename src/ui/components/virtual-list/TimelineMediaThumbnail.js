import React, { useState } from 'react';
import mediaTypes from '__constants/mediaTypes';
import style from './TimelineMediaThumbnail.css';
import keyCodes from '__constants/keyCodes';

const TimelineMediaThumbnail = ({ media, onThumbnailClick }) => {
    const [isThumbnailAvailable, setIsThumbnailAvailable] = useState(true);
    const isNsfw = Boolean(media.isNsfw || media.is_nsfw);

    const shouldShowImage = media.mediaType !== mediaTypes.AUDIO && media.thumbnailURL && isThumbnailAvailable;

    const openMedia = () => {
        onThumbnailClick?.(media);
    };

    const onKeyDown = (event) => {
        if (event.key !== keyCodes.ENTER && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        openMedia();
    };

    return (
        <div className={style.tmThumbnail} tabIndex={0} role="button" aria-label="Open" onClick={openMedia} onKeyDown={onKeyDown}>
            {shouldShowImage ? (
                <img
                    className={isNsfw ? style.tmThumbnailNsfwImage : undefined}
                    src={media.thumbnailURL}
                    alt=""
                    onError={() => setIsThumbnailAvailable(false)}
                />
            ) : media.mediaType === mediaTypes.AUDIO ? (
                <div className={style.tmAudioThumbnail}></div>
            ) : (
                <div className={style.tmThumbnailPlaceholder}>{media.mediaType}</div>
            )}
            {isNsfw ? <div className={style.tmThumbnailNsfwOverlay}>NSFW</div> : null}
        </div>
    );
};

export default TimelineMediaThumbnail;
