import React, { useEffect, useRef, useState } from 'react';
import style from './ContextualActionControl.css';

export const ContextualActionControl = ({ children }) => {
    const [isControlOpen, setIsControlOpen] = useState(false);
    const popupRef = useRef(null);

    const onControlButtonClick = () => {
        if (isControlOpen) {
            setIsControlOpen(false);
        } else {
            setIsControlOpen(true);
        }
    };

    const closeOptionsWindow = () => {
        setIsControlOpen(false);
    };

    const handleClickOutside = (event) => {
        if (popupRef.current && !popupRef.current.contains(event.target)) {
            closeOptionsWindow();
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            closeOptionsWindow();
        }
    };

    useEffect(() => {
        if (isControlOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isControlOpen]);

    return (
        <div className={style.contextualActionControl}>
            <div className={style.controlButton} onClick={() => onControlButtonClick()}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" />
                </svg>
            </div>
            {isControlOpen && (
                <div className={style.controlOptionsWindow} ref={popupRef}>
                    {children}
                </div>
            )}
        </div>
    );
};

export const ContextualActionButton = ({ children, onClick }) => {
    return (
        <div className={style.contextualActionButton} onClick={onClick}>
            {children}
        </div>
    );
};
