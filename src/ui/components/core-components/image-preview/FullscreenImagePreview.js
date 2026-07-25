import React, { useEffect, useRef, useState } from 'react';
import style from './ImagePreview.css';
import keyCodes from '__constants/keyCodes';
import IconButton from '../icon-button/IconButton';

const CONTROLS_HIDE_DELAY = 1500;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const DEFAULT_ZOOM = 1;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const FullscreenImagePreview = ({ isOpen, src, alt, onClose }) => {
    const [showCloseButton, setShowCloseButton] = useState(true);
    const hideControlsTimerRef = useRef(null);
    const previewContentRef = useRef(null);
    const imageRef = useRef(null);
    const zoomFactorRef = useRef(DEFAULT_ZOOM);
    const translateXRef = useRef(0);
    const translateYRef = useRef(0);
    const dragStateRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        initialTranslateX: 0,
        initialTranslateY: 0,
    });

    const clearHideControlsTimer = () => {
        if (hideControlsTimerRef.current) {
            clearTimeout(hideControlsTimerRef.current);
            hideControlsTimerRef.current = null;
        }
    };

    const getPanBounds = () => {
        if (!imageRef.current || !previewContentRef.current) {
            return {
                minX: 0,
                maxX: 0,
                minY: 0,
                maxY: 0,
            };
        }

        const containerRect = previewContentRef.current.getBoundingClientRect();

        const baseWidth = imageRef.current.offsetWidth;
        const baseHeight = imageRef.current.offsetHeight;

        const scaledWidth = baseWidth * zoomFactorRef.current;
        const scaledHeight = baseHeight * zoomFactorRef.current;

        const maxOffsetX = Math.max(0, (scaledWidth - containerRect.width) / 2);
        const maxOffsetY = Math.max(0, (scaledHeight - containerRect.height) / 2);

        return {
            minX: -maxOffsetX,
            maxX: maxOffsetX,
            minY: -maxOffsetY,
            maxY: maxOffsetY,
        };
    };

    const clampPanToBounds = () => {
        const bounds = getPanBounds();

        translateXRef.current = clamp(translateXRef.current, bounds.minX, bounds.maxX);
        translateYRef.current = clamp(translateYRef.current, bounds.minY, bounds.maxY);
    };

    const scheduleHideControls = () => {
        clearHideControlsTimer();
        hideControlsTimerRef.current = setTimeout(() => {
            setShowCloseButton(false);
        }, CONTROLS_HIDE_DELAY);
    };

    const revealControls = () => {
        setShowCloseButton(true);
        scheduleHideControls();
    };

    const applyTransform = () => {
        if (imageRef.current) {
            clampPanToBounds();

            imageRef.current.style.transform = `translate(${translateXRef.current}px, ${translateYRef.current}px) scale(${zoomFactorRef.current})`;
            imageRef.current.style.transformOrigin = 'center center';
            imageRef.current.style.willChange = 'transform';
            imageRef.current.style.cursor = zoomFactorRef.current > DEFAULT_ZOOM ? 'grab' : 'default';
        }
    };

    const resetTransform = () => {
        zoomFactorRef.current = DEFAULT_ZOOM;
        translateXRef.current = 0;
        translateYRef.current = 0;
        applyTransform();
    };

    const adjustZoom = (scaleFactor) => {
        const nextZoom = zoomFactorRef.current * scaleFactor;
        zoomFactorRef.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));

        if (zoomFactorRef.current <= DEFAULT_ZOOM) {
            translateXRef.current = 0;
            translateYRef.current = 0;
        }

        applyTransform();
    };

    useEffect(() => {
        if (!isOpen) {
            clearHideControlsTimer();
            setShowCloseButton(true);
            resetTransform();
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === keyCodes.ESCAPE) {
                onClose();
            }
        };

        setShowCloseButton(true);
        resetTransform();
        scheduleHideControls();
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            clearHideControlsTimer();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        resetTransform();
    }, [src]);

    const onWheelEvent = (event) => {
        revealControls();

        if (!event.ctrlKey) {
            return;
        }

        event.preventDefault();
        const scaleFactor = event.deltaY < 0 ? 1.05 : 0.95;
        adjustZoom(scaleFactor);
    };

    useEffect(() => {
        const element = previewContentRef.current;

        if (!isOpen || !element) {
            return undefined;
        }

        element.addEventListener('wheel', onWheelEvent, { passive: false });

        return () => {
            element.removeEventListener('wheel', onWheelEvent);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleMouseMove = (event) => {
            if (!dragStateRef.current.isDragging) {
                return;
            }

            const deltaX = event.clientX - dragStateRef.current.startX;
            const deltaY = event.clientY - dragStateRef.current.startY;

            translateXRef.current = dragStateRef.current.initialTranslateX + deltaX;
            translateYRef.current = dragStateRef.current.initialTranslateY + deltaY;

            applyTransform();
        };

        const handleMouseUp = () => {
            if (!dragStateRef.current.isDragging) {
                return;
            }

            dragStateRef.current.isDragging = false;

            if (imageRef.current) {
                imageRef.current.style.cursor = zoomFactorRef.current > DEFAULT_ZOOM ? 'grab' : 'default';
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleOverlayClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
    };

    const handleContentClick = (event) => {
        event.stopPropagation();
    };

    const handleContextMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleImageMouseDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        revealControls();

        if (zoomFactorRef.current <= DEFAULT_ZOOM) {
            return;
        }

        dragStateRef.current = {
            isDragging: true,
            startX: event.clientX,
            startY: event.clientY,
            initialTranslateX: translateXRef.current,
            initialTranslateY: translateYRef.current,
        };

        if (imageRef.current) {
            imageRef.current.style.cursor = 'grabbing';
        }
    };

    const imageControlClass = showCloseButton
        ? `${style.fullscreenCloseControl} ${style.fullscreenCloseButtonVisible}`
        : `${style.fullscreenCloseControl} ${style.fullscreenCloseButtonHidden}`;

    return (
        <div
            ref={previewContentRef}
            className={style.fullscreenPreviewOverlay}
            onClick={handleOverlayClick}
            onContextMenu={handleContextMenu}
            onMouseMove={revealControls}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
        >
            <div className={imageControlClass}>
                <IconButton
                    icon="close"
                    _classes={style.imageControlButton}
                    onClick={handleOverlayClick}
                    aria-label="Close image preview"
                    title="Close image preview"
                />
            </div>

            <div className={style.fullscreenPreviewContent} onClick={handleContentClick}>
                <img
                    ref={imageRef}
                    src={src}
                    alt={alt}
                    className={style.fullscreenPreviewImage}
                    onMouseMove={revealControls}
                    onMouseDown={handleImageMouseDown}
                />
            </div>
        </div>
    );
};

export default FullscreenImagePreview;
