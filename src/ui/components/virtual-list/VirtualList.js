import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import TimelineMediaThumbnail from './TimelineMediaThumbnail';
import style from './VirtualList.css';

const THUMBNAIL_WIDTH = 176;
const THUMBNAIL_HEIGHT = 99;
const COLUMN_GAP = 16;
const ROW_GAP = 24;
const VERTICAL_PADDING = 10;
const MONTH_HEADER_HEIGHT = 24;
const MONTH_HEADER_GAP = 12;
const OVERSCAN_ROWS = 3;

const monthFormatter = new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
});

const getMonthKey = (birthtimeMs) => {
    const date = new Date(birthtimeMs);
    return `${date.getFullYear()}-${date.getMonth()}`;
};

const getMonthLabel = (birthtimeMs) => monthFormatter.format(new Date(birthtimeMs));

const getTimestamp = (value) => {
    const timestamp = value instanceof Date ? value.getTime() : Number(value);
    return Number.isFinite(timestamp) ? timestamp : null;
};

const getSnapIndexForDate = (items, value) => {
    const timestamp = getTimestamp(value);

    if (timestamp === null) {
        return null;
    }

    const targetDate = new Date(timestamp);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const sameMonthIndex = items.findIndex((item) => {
        const itemDate = new Date(item.birthtimeMs);
        return itemDate.getFullYear() === targetYear && itemDate.getMonth() === targetMonth;
    });

    if (sameMonthIndex !== -1) {
        return sameMonthIndex;
    }

    let closestIndex = null;
    let closestDistance = Infinity;

    items.forEach((item, index) => {
        const itemTimestamp = Number(item.birthtimeMs);

        if (!Number.isFinite(itemTimestamp)) {
            return;
        }

        const distance = Math.abs(itemTimestamp - timestamp);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
        }
    });

    return closestIndex;
};

const VirtualList = ({ items = [], cursorAt = null, scrollToDate = null, onVisibleDateChange = null, onListItemClick = null }) => {
    const containerRef = useRef(null);
    const scrollTopRef = useRef(0);
    const lastVisibleMonthKeyRef = useRef(null);
    const pendingProgrammaticScrollTopRef = useRef(null);
    const animationFrameRef = useRef(null);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [scrollTop, setScrollTop] = useState(0);

    const measureViewport = useCallback(() => {
        if (!containerRef.current) {
            return;
        }

        const container = containerRef.current;
        const { width, height } = container.getBoundingClientRect();

        const measuredWidth = Math.floor(width || container.clientWidth || window.innerWidth);
        const measuredHeight = Math.floor(height || container.clientHeight);

        setViewport({
            width: measuredWidth,
            height: measuredHeight,
        });
        setScrollTop(container.scrollTop);
    }, []);

    useLayoutEffect(() => {
        measureViewport();

        const container = containerRef.current;
        if (!container) {
            return undefined;
        }

        const measureOnNextFrame = () => requestAnimationFrame(measureViewport);

        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(measureOnNextFrame);
            resizeObserver.observe(container);

            if (container.parentElement) {
                resizeObserver.observe(container.parentElement);
            }

            return () => resizeObserver.disconnect();
        }

        window.addEventListener('resize', measureViewport);
        return () => window.removeEventListener('resize', measureViewport);
    }, [items.length, measureViewport]);

    useEffect(
        () => () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        },
        [],
    );

    const layout = useMemo(() => {
        const itemWidth = THUMBNAIL_WIDTH + COLUMN_GAP;
        const itemHeight = THUMBNAIL_HEIGHT + ROW_GAP;
        const columnCount = Math.max(1, Math.floor((viewport.width + COLUMN_GAP) / itemWidth));
        const rows = [];
        const itemTopByIndex = new Map();
        let top = VERTICAL_PADDING;
        let itemIndex = 0;

        while (itemIndex < items.length) {
            const monthKey = getMonthKey(items[itemIndex].birthtimeMs);
            const monthLabel = getMonthLabel(items[itemIndex].birthtimeMs);
            const groupStartIndex = itemIndex;

            rows.push({
                type: 'month',
                key: monthKey,
                label: monthLabel,
                top,
                height: MONTH_HEADER_HEIGHT,
            });
            top += MONTH_HEADER_HEIGHT + MONTH_HEADER_GAP;

            while (itemIndex < items.length && getMonthKey(items[itemIndex].birthtimeMs) === monthKey) {
                const rowStartIndex = itemIndex;
                const rowItems = [];

                for (let columnIndex = 0; columnIndex < columnCount && itemIndex < items.length; columnIndex += 1) {
                    if (getMonthKey(items[itemIndex].birthtimeMs) !== monthKey) {
                        break;
                    }

                    itemTopByIndex.set(itemIndex, top);
                    rowItems.push({
                        item: items[itemIndex],
                        index: itemIndex,
                        left: columnIndex * itemWidth,
                    });
                    itemIndex += 1;
                }

                rows.push({
                    type: 'media',
                    key: `${monthKey}-${rowStartIndex}`,
                    top,
                    height: THUMBNAIL_HEIGHT,
                    items: rowItems,
                });
                top += itemHeight;
            }

            if (itemIndex > groupStartIndex) {
                top += MONTH_HEADER_GAP;
            }
        }

        return {
            columnCount,
            itemHeight,
            itemTopByIndex,
            rows,
            totalHeight: Math.max(viewport.height, top + VERTICAL_PADDING - ROW_GAP),
        };
    }, [items, viewport.height, viewport.width]);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const scrollToIndex = scrollToDate !== null && scrollToDate !== undefined ? getSnapIndexForDate(items, scrollToDate) : null;
        const targetIndex = scrollToIndex !== null ? scrollToIndex : cursorAt;

        if (targetIndex === null || targetIndex === undefined) {
            return;
        }

        const itemTop = layout.itemTopByIndex.get(targetIndex);
        if (itemTop !== undefined) {
            pendingProgrammaticScrollTopRef.current = itemTop;
            containerRef.current.scrollTop = itemTop;
            scrollTopRef.current = itemTop;
            setScrollTop(itemTop);
        }
    }, [cursorAt, items, layout.itemTopByIndex, scrollToDate]);

    const onScroll = useCallback((event) => {
        scrollTopRef.current = event.currentTarget.scrollTop;

        if (animationFrameRef.current) {
            return;
        }

        animationFrameRef.current = requestAnimationFrame(() => {
            setScrollTop(scrollTopRef.current);
            animationFrameRef.current = null;
        });
    }, []);

    const visibleRows = useMemo(() => {
        const overscan = OVERSCAN_ROWS * layout.itemHeight;
        const minTop = Math.max(0, scrollTop - overscan);
        const maxTop = scrollTop + viewport.height + overscan;

        return layout.rows.filter((row) => row.top + row.height >= minTop && row.top <= maxTop);
    }, [layout.itemHeight, layout.rows, scrollTop, viewport.height]);

    useEffect(() => {
        if (!items.length) {
            return;
        }

        const firstVisibleMediaRow = layout.rows.find(
            (row) => row.type === 'media' && row.top + row.height >= scrollTop && row.items.length,
        );
        const firstVisibleItem = firstVisibleMediaRow?.items[0]?.item;

        if (!firstVisibleItem) {
            return;
        }

        const visibleMonthKey = getMonthKey(firstVisibleItem.birthtimeMs);
        if (visibleMonthKey === lastVisibleMonthKeyRef.current) {
            return;
        }

        lastVisibleMonthKeyRef.current = visibleMonthKey;

        if (pendingProgrammaticScrollTopRef.current === scrollTop) {
            pendingProgrammaticScrollTopRef.current = null;
            return;
        }

        if (onVisibleDateChange) {
            onVisibleDateChange(new Date(firstVisibleItem.birthtimeMs));
        }
    }, [items.length, layout.rows, onVisibleDateChange, scrollTop]);

    return (
        <div ref={containerRef} className={style.virtualListContainer} onScroll={onScroll}>
            {!items.length ? (
                <div>No media found</div>
            ) : (
                <div className={style.virtualListContent} style={{ height: layout.totalHeight }}>
                    {visibleRows.map((row) =>
                        row.type === 'month' ? (
                            <div
                                key={row.key}
                                className={style.virtualListMonthHeader}
                                style={{ transform: `translate3d(0, ${row.top}px, 0)` }}
                            >
                                {row.label}
                            </div>
                        ) : (
                            row.items.map(({ item, index, left }) => (
                                <div
                                    key={`${item.mediaType}-${item.mediaId}-${index}`}
                                    className={style.virtualListItem}
                                    style={{ transform: `translate3d(${left}px, ${row.top}px, 0)` }}
                                >
                                    <TimelineMediaThumbnail media={item} onThumbnailClick={onListItemClick} />
                                </div>
                            ))
                        ),
                    )}
                </div>
            )}
        </div>
    );
};

export default VirtualList;
