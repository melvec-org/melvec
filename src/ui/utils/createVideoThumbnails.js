import rendererEvents from '__events/rendererEvents';
import ipcChannels from '__constants/ipcChannels';

const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;

/**
 * This is a fallback mechanism where backend thumbnail creation fails.
 *
 * Calculates the position to crop a screenshot to fit within a thumbnail while maintaining the aspect ratio.
 *
 * @param {number} [thumbnailWidth=THUMBNAIL_WIDTH] - The width of the thumbnail.
 * @param {number} [thumbnailHeight=THUMBNAIL_HEIGHT] - The height of the thumbnail.
 * @param {number} [screenshotWidth=1] - The width of the screenshot.
 * @param {number} [screenshotHeight=1] - The height of the screenshot.
 * @returns {Object} - An object containing the `x` and `y` coordinates for cropping the screenshot.
 *                     - `x`: The horizontal position to start cropping.
 *                     - `y`: The vertical position to start cropping.
 *
 * The function compares the aspect ratios of the thumbnail and the screenshot:
 * - If the aspect ratios are equal, no cropping is needed, and the position remains at {x: 0, y: 0}.
 * - If the screenshot's aspect ratio is greater than the thumbnail's, the function calculates the vertical position (`y`) to center the screenshot.
 * - If the screenshot's aspect ratio is less than the thumbnail's, the function calculates the horizontal position (`x`) to center the screenshot.
 */
const getImagePositionAndDimension = (
    thumbnailWidth = THUMBNAIL_WIDTH,
    thumbnailHeight = THUMBNAIL_HEIGHT,
    screenshotWidth = 1,
    screenshotHeight = 1,
) => {
    const thumbnailRatio = thumbnailWidth / thumbnailHeight;
    const screenshotRatio = screenshotWidth / screenshotHeight;

    const EPSILON = 0.0001; // tolerance for float comparison

    let posDim = { x: 0, y: 0, w: 0, h: 0 };

    if (Math.abs(screenshotRatio - thumbnailRatio) < EPSILON) {
        posDim = {
            x: 0,
            y: 0,
            w: thumbnailWidth,
            h: thumbnailHeight,
        };
    }

    if (screenshotRatio > thumbnailRatio) {
        const _scHeight = screenshotHeight / (screenshotWidth / thumbnailWidth);
        posDim = {
            x: 0,
            y: Math.round((thumbnailHeight - _scHeight) / 2),
            w: thumbnailWidth,
            h: _scHeight,
        };
    }

    if (screenshotRatio < thumbnailRatio) {
        const _scWidth = screenshotWidth / (screenshotHeight / thumbnailHeight);
        posDim = {
            x: Math.round((thumbnailWidth - _scWidth) / 2),
            y: 0,
            w: _scWidth,
            h: thumbnailHeight,
        };
    }
    return posDim;
};

const VIDEO_THUMBNAIL_TIMEOUT = 15000;

const getVideoImage = async (uid, path) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        let isSettled = false;
        let timeoutId;

        const cleanup = () => {
            clearTimeout(timeoutId);
            video.onloadedmetadata = null;
            video.onseeked = null;
            video.onerror = null;
            video.pause();
            video.removeAttribute('src');
            video.load();
        };

        const settle = (callback) => {
            if (isSettled) {
                return;
            }

            isSettled = true;
            cleanup();
            callback();
        };

        // Optimization: Only load metadata initially
        video.preload = 'metadata';

        timeoutId = setTimeout(() => {
            settle(() => reject(new Error(`Video thumbnail creation timed out for ${path}`)));
        }, VIDEO_THUMBNAIL_TIMEOUT);

        video.onloadedmetadata = () => {
            const secs = parseInt(video.duration / 2) + 1;
            // Trigger the seek
            video.currentTime = Math.min(Math.max(0, (secs < 0 ? video.duration : 0) + secs), video.duration);
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.height = THUMBNAIL_HEIGHT;
                canvas.width = THUMBNAIL_WIDTH;

                const ctx = canvas.getContext('2d');
                const positionDim = getImagePositionAndDimension(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, video.videoWidth, video.videoHeight);

                ctx.drawImage(video, positionDim.x, positionDim.y, positionDim.w, positionDim.h);

                const URL = canvas.toDataURL('image/jpg', 1);
                const base64Data = URL.replace(/^data:image\/png;base64,/, '');

                window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                    event: rendererEvents.THUMBNAIL_SAVE,
                    videoId: uid,
                    imgBase64Data: base64Data,
                });

                settle(() => resolve(true));
            } catch (err) {
                settle(() => reject(err));
            }
        };

        video.onerror = (e) => {
            settle(() => reject(new Error(`Video load/seek failed: ${e.message || e}`)));
        };

        video.src = path;
        video.load();
    });
};

export default getVideoImage;
