import { getMonthLayouts } from './timelineScaleLayout';

export const POINTER_HIT_RADIUS = 8;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Converts a pointer event into canvas-local coordinates.
 *
 * @param {PointerEvent|MouseEvent} event - Browser pointer event with viewport coordinates.
 * @param {HTMLCanvasElement} canvas - Canvas used as the coordinate reference.
 * @returns {{ x: number, y: number }} Point relative to the canvas top-left corner.
 */
export const getCanvasPoint = (event, canvas) => {
    const rect = canvas.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
    };
};

/**
 * Finds the year segment containing a canvas point.
 *
 * @param {{ yearSegments: Object[] }} layout - Timeline layout from getTimelineLayout.
 * @param {{ y: number }} point - Canvas-local point to test.
 * @returns {Object|null} Matching year segment, or null when the point is outside all segments.
 */
export const getSegmentAtPoint = (layout, point) => {
    return layout.yearSegments.find((segment) => point.y >= segment.y && point.y <= segment.y + segment.height) || null;
};

/**
 * Finds the month layout at a point inside a year segment.
 * If the point falls in a gap between month bars, the nearest month bar is returned
 * so pointer interaction still maps to a meaningful month.
 *
 * @param {{ y: number, height: number, monthlyCount: number[] }} segment - Positioned year segment.
 * @param {{ y: number }} point - Canvas-local point to test.
 * @returns {{ count: number, monthIndex: number, y: number, height: number }|null} Matching or nearest month layout.
 */
export const getMonthLayoutAtPoint = (segment, point) => {
    const monthLayouts = getMonthLayouts(segment);

    if (!monthLayouts.length) {
        return null;
    }

    const containingMonth = monthLayouts.find((monthLayout) => point.y >= monthLayout.y && point.y <= monthLayout.y + monthLayout.height);

    if (containingMonth) {
        return containingMonth;
    }

    return monthLayouts.reduce((nearestMonthLayout, monthLayout) => {
        const nearestDistance = Math.abs(point.y - (nearestMonthLayout.y + nearestMonthLayout.height / 2));
        const distance = Math.abs(point.y - (monthLayout.y + monthLayout.height / 2));

        return distance < nearestDistance ? monthLayout : nearestMonthLayout;
    }, monthLayouts[0]);
};

/**
 * Checks whether a point is close enough to grab an existing timeline pointer.
 *
 * @param {{ y: number }|null} point - Candidate pointer/mouse position.
 * @param {{ y: number }|null} pointer - Existing active pointer position.
 * @returns {boolean} True when the point is within POINTER_HIT_RADIUS vertically.
 */
export const isPointOnPointer = (point, pointer) => {
    return Boolean(point && pointer && Math.abs(point.y - pointer.y) <= POINTER_HIT_RADIUS);
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getMonthStart = (year, month) => new Date(year, month, 1).getTime();

const getMonthEnd = (year, month) => new Date(year, month + 1, 1).getTime();

/**
 * Maps a canvas point to a date inside the corresponding year/month.
 * The vertical position inside the month bar is preserved, so clicking near the top/bottom
 * of a month maps back to a matching pointer position instead of snapping to the center.
 *
 * @param {{ yearSegments: Object[] }} layout - Timeline layout from getTimelineLayout.
 * @param {{ y: number }} point - Canvas-local point to map.
 * @returns {Date|null} Date for the mapped position, or null when no segment/month is available.
 */
export const getDateAtPoint = (layout, point) => {
    const segment = getSegmentAtPoint(layout, point);

    if (!segment) {
        return null;
    }

    const monthLayout = getMonthLayoutAtPoint(segment, point);

    if (!monthLayout) {
        return null;
    }

    const clampedY = clamp(point.y, monthLayout.y, monthLayout.y + monthLayout.height);
    const monthProgress = monthLayout.height ? (clampedY - monthLayout.y) / monthLayout.height : 0;
    const monthStart = getMonthStart(segment.year, monthLayout.monthIndex);
    const monthEnd = getMonthEnd(segment.year, monthLayout.monthIndex);

    return new Date(monthStart + monthProgress * (monthEnd - monthStart - 1));
};

/**
 * Maps a date-like value to its proportional vertical position inside the matching month bar.
 * Values outside the rendered year/month range return null.
 *
 * @param {{ yearSegments: Object[] }} layout - Timeline layout from getTimelineLayout.
 * @param {Date|number|string|null} value - Date, timestamp, or timestamp-like value to locate.
 * @returns {{ x: number, y: number }|null} Pointer position for the date inside its month bar.
 */
export const getPointerFromDate = (layout, value) => {
    const timestamp = value instanceof Date ? value.getTime() : Number(value);

    if (!Number.isFinite(timestamp)) {
        return null;
    }

    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth();
    const segment = layout.yearSegments.find((yearSegment) => yearSegment.year === year);

    if (!segment) {
        return null;
    }

    const monthLayout = getMonthLayouts(segment).find(({ monthIndex }) => monthIndex === month);

    if (!monthLayout) {
        return null;
    }

    const monthStart = getMonthStart(year, month);
    const monthEnd = getMonthEnd(year, month);
    const monthProgress = clamp((timestamp - monthStart) / (monthEnd - monthStart - 1), 0, 1);

    return {
        x: 0,
        y: monthLayout.y + monthProgress * monthLayout.height,
    };
};

/**
 * Builds display metadata for the month represented by a canvas point.
 * Used by the hover/current pointer label in TimelineScaleCanvas.
 *
 * @param {{ yearSegments: Object[] }} layout - Timeline layout from getTimelineLayout.
 * @param {{ y: number }} point - Canvas-local point to describe.
 * @returns {{ date: Date, year: number, month: number, monthLabel: string, mediaCount: number, monthlyCount: number, percentage: number }|null} Display metadata for the mapped month.
 */
export const getPointTimeInfo = (layout, point) => {
    const date = getDateAtPoint(layout, point);

    if (!date) {
        return null;
    }

    const segment = getSegmentAtPoint(layout, point);
    const month = date.getMonth();

    return {
        date,
        year: date.getFullYear(),
        month,
        monthLabel: MONTH_LABELS[month],
        mediaCount: segment.mediaCount,
        monthlyCount: segment.monthlyCount[month],
        percentage: segment.percentage,
    };
};
