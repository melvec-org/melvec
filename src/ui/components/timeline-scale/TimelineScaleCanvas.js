import React, { useEffect, useMemo, useRef, useState } from 'react';
import style from './TimelineScale.css';
import drawTimelineScale from './timelineScaleDrawing';
import {
    getCanvasPoint,
    getDateAtPoint,
    getPointTimeInfo,
    getPointerFromDate,
    getSegmentAtPoint,
    isPointOnPointer,
    POINTER_HIT_RADIUS,
} from './timelineScaleHitTesting';
import { getTimelineLayout } from './timelineScaleLayout';

const CANVAS_HEIGHT_OFFSET = 40;

const TimelineScaleCanvas = ({ yearScale, currentDate = null, onDateChange = null }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const layout = useMemo(() => getTimelineLayout(yearScale, canvasSize.height), [canvasSize.height, yearScale]);
    const currentPointer = useMemo(() => getPointerFromDate(layout, currentDate), [currentDate, layout]);
    const [hoverPointer, setHoverPointer] = useState(null);
    const [dragPointer, setDragPointer] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const activePointer = dragPointer || currentPointer;
    const selectedYear = activePointer ? getSegmentAtPoint(layout, activePointer)?.year : null;
    const isHoveringActivePointer = isPointOnPointer(hoverPointer, activePointer);
    const pointerTimeInfo = hoverPointer
        ? getPointTimeInfo(layout, hoverPointer)
        : activePointer
          ? getPointTimeInfo(layout, activePointer)
          : null;

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return undefined;
        }

        const sizeElement = container.parentElement || container;
        const updateCanvasSize = () => {
            setCanvasSize({
                width: sizeElement.clientWidth,
                height: Math.max(0, sizeElement.clientHeight - CANVAS_HEIGHT_OFFSET),
            });
        };
        updateCanvasSize();

        if (!window.ResizeObserver) {
            window.addEventListener('resize', updateCanvasSize);
            return () => window.removeEventListener('resize', updateCanvasSize);
        }

        const resizeObserver = new ResizeObserver(updateCanvasSize);
        resizeObserver.observe(sizeElement);

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas || !canvasSize.width || !canvasSize.height) {
            return;
        }

        drawTimelineScale({
            canvas,
            layout,
            width: canvasSize.width,
            selectedYear,
        });
    }, [canvasSize, layout, selectedYear]);

    const emitDateChange = (point) => {
        const date = getDateAtPoint(layout, point);

        if (date && onDateChange) {
            onDateChange(date);
        }
    };

    const updateDragPointer = (event) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const point = getCanvasPoint(event, canvas);
        const segment = getSegmentAtPoint(layout, point);

        if (!segment) {
            return;
        }

        setDragPointer(point);
        setHoverPointer(point);
        emitDateChange(point);
    };

    const handlePointerMove = (event) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        if (isDragging) {
            updateDragPointer(event);
            return;
        }

        setHoverPointer(getCanvasPoint(event, canvas));
    };

    const handlePointerDown = (event) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const point = getCanvasPoint(event, canvas);
        const pointerToGrab = activePointer || point;

        if (Math.abs(point.y - pointerToGrab.y) > POINTER_HIT_RADIUS) {
            return;
        }

        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        setIsDragging(true);
        updateDragPointer(event);
    };

    const handlePointerUp = (event) => {
        const canvas = canvasRef.current;

        if (canvas && canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }

        setIsDragging(false);
        setDragPointer(null);
    };

    const handlePointerLeave = () => {
        if (!isDragging) {
            setHoverPointer(null);
        }
    };

    const handleClick = (event) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const point = getCanvasPoint(event, canvas);

        setHoverPointer(point);
        emitDateChange(point);
    };

    return (
        <div ref={containerRef} className={style.timelineScaleCanvasWrapper}>
            <canvas
                ref={canvasRef}
                className={style.timelineScaleCanvas}
                style={{ cursor: isDragging || isHoveringActivePointer ? 'move' : 'crosshair' }}
                width={canvasSize.width}
                height={layout.height}
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onClick={handleClick}
            />
            {hoverPointer ? (
                <div className={style.timelineScaleHoverPointer} style={{ transform: `translate3d(0, ${hoverPointer.y}px, 0)` }} />
            ) : null}
            {activePointer ? (
                <div
                    className={`${style.timelineScaleCurrentPointer} ${isDragging ? style.timelineScaleCurrentPointerDragging : ''}`}
                    style={{ transform: `translate3d(0, ${activePointer.y}px, 0)` }}
                />
            ) : null}
            {pointerTimeInfo ? (
                <div className={style.timelineScalePointerInfo}>
                    {pointerTimeInfo.monthLabel} {pointerTimeInfo.year} · {pointerTimeInfo.monthlyCount} media
                </div>
            ) : null}
        </div>
    );
};

export default TimelineScaleCanvas;
