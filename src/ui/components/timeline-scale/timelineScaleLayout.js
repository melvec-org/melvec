export const CANVAS_PADDING = 0;

const MIN_YEAR_SEGMENT_HEIGHT = 32;
const MONTH_STICK_GAP = 3;

/**
 * Builds the list of months that should be drawn for a year segment.
 * Empty months are removed, and the order is reversed so newer months appear first
 * in the vertical timeline layout.
 *
 * @param {Object} yearData - Year scale data for one year.
 * @param {number[]} yearData.monthlyCount - Media counts indexed by month, where 0 is January.
 * @returns {{ count: number, monthIndex: number }[]} Visible month counts in draw order.
 */
export const getVisibleMonthlyCounts = (yearData) => {
    return yearData.monthlyCount
        .map((count, monthIndex) => ({ count, monthIndex }))
        .filter(({ count }) => count > 0)
        .reverse();
};

/**
 * Calculates vertical timeline segments for the provided yearly media scale.
 * Each year receives a minimum height, then remaining height is distributed by
 * media count. If there is no media count at all, remaining height is shared evenly.
 *
 * @param {{ year: number, mediaCount: number, monthlyCount: number[], percentage?: number }[]} yearScale - Yearly media scale data.
 * @param {number} [availableHeight=0] - Available canvas height in CSS pixels.
 * @returns {{ yearSegments: Object[], height: number }} Layout with positioned year segments and total canvas height.
 */
export const getTimelineLayout = (yearScale = [], availableHeight = 0) => {
    const minimumRequiredHeight = yearScale.length * MIN_YEAR_SEGMENT_HEIGHT;
    const drawableHeight = Math.max(minimumRequiredHeight, availableHeight - CANVAS_PADDING * 2);
    const totalMediaCount = yearScale.reduce((sum, yearData) => sum + yearData.mediaCount, 0);
    const weightedHeight = Math.max(0, drawableHeight - minimumRequiredHeight);
    let y = CANVAS_PADDING;

    const yearSegments = yearScale.map((yearData) => {
        const weightedSegmentHeight = totalMediaCount ? (weightedHeight * yearData.mediaCount) / totalMediaCount : 0;
        const equalSegmentHeight = !totalMediaCount && yearScale.length ? weightedHeight / yearScale.length : 0;
        const height = MIN_YEAR_SEGMENT_HEIGHT + weightedSegmentHeight + equalSegmentHeight;
        const segment = {
            ...yearData,
            y,
            height,
        };

        y += height;
        return segment;
    });

    return {
        yearSegments,
        height: y + CANVAS_PADDING,
    };
};

/**
 * Calculates vertical month bars inside a positioned year segment.
 * Months are sized proportionally to their media count within the year, with a fixed
 * visual gap between adjacent visible month bars.
 *
 * @param {{ y: number, height: number, monthlyCount: number[] }} segment - Positioned year segment from getTimelineLayout.
 * @returns {{ count: number, monthIndex: number, y: number, height: number }[]} Positioned month bar layouts.
 */
export const getMonthLayouts = (segment) => {
    const visibleMonthlyCounts = getVisibleMonthlyCounts(segment);
    const monthAreaHeight = Math.max(0, segment.height - 12);
    const gapHeight = visibleMonthlyCounts.length > 1 ? MONTH_STICK_GAP * (visibleMonthlyCounts.length - 1) : 0;
    const drawableMonthHeight = Math.max(0, monthAreaHeight - gapHeight);
    const totalMonthlyCount = visibleMonthlyCounts.reduce((sum, { count }) => sum + count, 0);
    let monthY = segment.y + 6;

    return visibleMonthlyCounts.map(({ count, monthIndex }, index) => {
        if (index) {
            monthY += MONTH_STICK_GAP;
        }

        const height = totalMonthlyCount ? (count / totalMonthlyCount) * drawableMonthHeight : 0;
        const monthLayout = {
            count,
            monthIndex,
            y: monthY,
            height,
        };

        monthY += height;
        return monthLayout;
    });
};
