import React, { useEffect, useRef, useState } from 'react';
import style from './ResizableSidePanel.css';
import throttle from '__utils/throttle';

const ResizableSidePanel = ({
    direction = 'right',
    minWidth = 200,
    maxWidth = 500,
    initialWidth = 300,
    children,
    panelId,
}) => {
    const [panelWidth, setPanelWidth] = useState(null);
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(initialWidth);
    const panelRef = useRef(null);

    useEffect(() => {
        if (panelId && window.api) {
            window.api.getApplicationSettings(`${panelId}_width`).then((savedWidth) => {
                if (typeof savedWidth === 'number' && savedWidth >= minWidth && savedWidth <= maxWidth) {
                    setPanelWidth(savedWidth);
                } else {
                    setPanelWidth(initialWidth);
                }
            });
        } else {
            setPanelWidth(initialWidth);
        }
    }, [panelId]);

    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = panelWidth;
    };

    useEffect(() => {
        const throttledMouseMove = throttle((e) => {
            if (!isResizing) return;

            const dx = e.clientX - startXRef.current;
            let newWidth = direction === 'left' ? startWidthRef.current - dx : startWidthRef.current + dx;

            newWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

            if (panelRef.current) {
                panelRef.current.style.width = `${newWidth}px`;
            }
        }, 50);
        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                const currentWidth = panelRef.current.offsetWidth;
                setPanelWidth(currentWidth);
                if (panelId && window.api) {
                    window.api.setApplicationSettings(`${panelId}_width`, currentWidth);
                }
            }
        };
        if (isResizing) {
            window.addEventListener('mousemove', throttledMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', throttledMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, direction, minWidth, maxWidth, panelWidth]);

    if (panelWidth === null) return null; // Wait for panel width to be set before rendering (if panelId is provided and settings are saved)
    return (
        <div ref={panelRef} className={`${style.resizer} ${style[direction]}`} style={{ width: panelWidth }}>
            {children}
            <div
                className={`${style.handle} ${style[direction]} ${isResizing ? style.active : ''}`}
                onMouseDown={handleMouseDown}
            ></div>
        </div>
    );
};
export default ResizableSidePanel;
