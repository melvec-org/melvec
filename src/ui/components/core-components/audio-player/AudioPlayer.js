import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import AudioPlayerStyles from './AudioPlayer.css';

import Button from '../button/Button';
const AudioPlayer = forwardRef(({ src, isNsfw = false, hideNsfwContent = false, onLoad, onLoadError = undefined }, ref) => {
    const extension = src.split('.').pop();
    const type = `audio/${extension}`;
    const audioRef = useRef(null);
    const [isRevealed, setIsRevealed] = useState(false);
    const [loadingError, setLoadingError] = useState(false);
    const shouldHideContent = Boolean(isNsfw && hideNsfwContent && !isRevealed);

    useImperativeHandle(ref, () => ({
        reveal: () => setIsRevealed(true),
        element: audioRef.current,
    }));

    useEffect(() => {
        if (src) {
            setIsRevealed(false);
            setLoadingError(false);
        }
    }, [src]);

    const handleReveal = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsRevealed(true);
    };

    const onAudioLoadingFailure = (e) => {
        setLoadingError(true);
        setTimeout(() => {
            if (typeof onLoadError === 'function') onLoadError();
        }, 10);
    };

    return (
        <div className={AudioPlayerStyles.audioPlayerWrapper}>
            {!loadingError && (
                <audio
                    className={AudioPlayerStyles.audioPlayer}
                    controls={!shouldHideContent}
                    onLoad={onLoad}
                    onError={onAudioLoadingFailure}
                >
                    <source src={src} type={type} />
                </audio>
            )}
            {shouldHideContent && (
                <div className={style.nsfwMessageWrapper}>
                    <div className={style.nsfwMessage}>Sensitive content: playing disabled</div>
                    <Button type="button" className={style.enableButton} onClick={handleReveal}>
                        Play Audio
                    </Button>
                </div>
            )}
        </div>
    );
});

export default AudioPlayer;
