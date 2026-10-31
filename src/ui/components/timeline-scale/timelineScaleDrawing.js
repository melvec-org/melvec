import { CANVAS_PADDING, getMonthLayouts } from './timelineScaleLayout';

const YEAR_LABEL_WIDTH = 44;

/**
 * Draws the timeline scale into a canvas using the computed year/month layout.
 * The function updates the canvas backing resolution for the current device pixel
 * ratio, applies CSS custom-property colors, highlights the selected year, and
 * renders proportional month bars for each year segment.
 *
 * @param {Object} options - Draw options.
 * @param {HTMLCanvasElement} options.canvas - Canvas element to draw into.
 * @param {{ yearSegments: Object[], height: number }} options.layout - Positioned timeline layout from getTimelineLayout.
 * @param {number} options.width - Canvas width in CSS pixels.
 * @param {number|null} options.selectedYear - Year to highlight, or null when no year is active.
 * @returns {void}
 */
const drawTimelineScale = ({ canvas, layout, width, selectedYear }) => {
    const context = canvas.getContext('2d');
    const devicePixelRatio = window.devicePixelRatio || 1;
    const primaryColor = getComputedStyle(canvas).getPropertyValue('--timeline-bar-color').trim() || '#969696';
    const textColor = getComputedStyle(canvas).getPropertyValue('--timeline-year-color').trim() || '#999';
    const separatorColor = getComputedStyle(canvas).getPropertyValue('--section-separator-color').trim() || 'rgba(128, 128, 128, 0.25)';
    const monthStartX = CANVAS_PADDING + YEAR_LABEL_WIDTH;
    const monthTickMaxWidth = Math.max(24, width - monthStartX - CANVAS_PADDING);

    canvas.width = width * devicePixelRatio;
    canvas.height = layout.height * devicePixelRatio;
    canvas.style.height = `${layout.height}px`;

    context.scale(devicePixelRatio, devicePixelRatio);
    context.clearRect(0, 0, width, layout.height);
    context.font = '800 15px -apple-system, BlinkMacSystemFont, sans-serif';
    context.textBaseline = 'middle';

    layout.yearSegments.forEach((segment) => {
        const isSelected = selectedYear === segment.year;
        const segmentBottom = segment.y + segment.height;

        context.fillStyle = isSelected ? 'rgba(0,0,0, 0.1)' : 'rgba(128, 128, 128, 0)';
        context.fillRect(CANVAS_PADDING / 2, segment.y, width - CANVAS_PADDING, segment.height);

        context.fillStyle = textColor;
        context.fillText(String(segment.year), CANVAS_PADDING, segment.y + 12);

        const localMaxMonthlyCount = Math.max(...segment.monthlyCount, 1);

        getMonthLayouts(segment).forEach(({ count, y, height }) => {
            const tickWidth = Math.max(2, (count / localMaxMonthlyCount) * monthTickMaxWidth);
            const x = monthStartX;

            context.fillStyle = primaryColor;
            context.fillRect(x, y, tickWidth, height);
        });

        context.strokeStyle = separatorColor;
        context.beginPath();
        context.moveTo(CANVAS_PADDING / 2, segmentBottom);
        context.lineTo(width - CANVAS_PADDING / 2, segmentBottom);
        context.stroke();
    });
};

export default drawTimelineScale;
