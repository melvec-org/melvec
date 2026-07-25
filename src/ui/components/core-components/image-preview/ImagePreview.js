import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import style from './ImagePreview.css';
import Button from '../button/Button';
import FullscreenImagePreview from './FullscreenImagePreview';
import IconButton from '../icon-button/IconButton';

const ImagePreview = forwardRef(
    ({ src, alt, onLoad, onContextMenu, isNsfw = false, hideNsfwContent = false, onLoadError = undefined }, ref) => {
        const [isRevealed, setIsRevealed] = useState(false);
        const imageRef = useRef(null);
        const [loadingError, setLoadingError] = useState(false);
        const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState(false);

        const shouldHideContent = Boolean(isNsfw && hideNsfwContent && !isRevealed);

        useImperativeHandle(ref, () => ({
            reveal: () => setIsRevealed(true),
            element: imageRef.current,
        }));

        useEffect(() => {
            if (src) {
                setIsRevealed(false);
                setLoadingError(false);
                setIsFullscreenPreviewOpen(false);
            }
        }, [src]);

        const handleReveal = (event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsRevealed(true);
        };

        const handleOverlayContextMenu = (event) => {
            event.preventDefault();
            event.stopPropagation();
        };

        const onImagePreviewFailure = () => {
            setLoadingError(true);
            setTimeout(() => {
                if (typeof onLoadError === 'function') onLoadError();
            }, 10);
        };

        const openFullscreenPreview = (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!loadingError && src && !shouldHideContent) {
                setIsFullscreenPreviewOpen(true);
            }
        };

        const closeFullscreenPreview = () => {
            setIsFullscreenPreviewOpen(false);
        };

        const wrapperClassName = shouldHideContent ? `${style.previewContainer} ${style.hiddenNsfw}` : style.previewContainer;
        const imageClassName = shouldHideContent ? `${style.previewImage} ${style.blurredImage}` : style.previewImage;

        return (
            <>
                <div className={wrapperClassName} onContextMenu={onContextMenu}>
                    {!loadingError && (
                        <>
                            <img
                                ref={imageRef}
                                src={src}
                                alt={alt}
                                className={imageClassName}
                                onLoad={onLoad}
                                onError={onImagePreviewFailure}
                                onDoubleClick={openFullscreenPreview}
                            />
                            <div className={style.imagePreviewControls}>
                                <IconButton
                                    icon="expand"
                                    _classes={style.imageControlButton}
                                    title="Large review"
                                    onClick={openFullscreenPreview}
                                ></IconButton>
                            </div>
                        </>
                    )}

                    {shouldHideContent && (
                        <div className={style.hiddenNsfwOverlay} onContextMenu={handleOverlayContextMenu}>
                            <div className={style.hiddenNsfwOverlayContent}>
                                <div className={style.hiddenNsfwLabel}>Sensitive content hidden</div>
                                <Button type="button" className={style.revealButton} onClick={handleReveal}>
                                    Reveal image
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <FullscreenImagePreview isOpen={isFullscreenPreviewOpen} src={src} alt={alt} onClose={closeFullscreenPreview} />
            </>
        );
    },
);

export default ImagePreview;
