const { SUPPORTED_VIDEO_FORMATS } = require('../../configs/systemConfig');
const { respondSuccess, respondError } = require('../service-utils/sendToUI');
const { convertFormat, stopConversion } = require('./convertFormat');
const { optimizeVideo, stopOptimization } = require('./optimize');
const { resizeVideo, stopResize } = require('./resizeVideo');

/**
 * Starts a video format conversion after validating the incoming request payload.
 *
 * @param {{ videoPath?: string, format?: string }} config
 * @returns {Promise<Object>}
 */
const startVideoFormatConversionService = async (config = {}) => {
    try {
        const { videoPath, format } = config;

        if (!videoPath || typeof videoPath !== 'string' || videoPath.trim() === '') {
            return respondError('Invalid video path');
        }

        if (!format || typeof format !== 'string' || format.trim() === '') {
            return respondError('Invalid video format');
        }

        const normalizedFormat = format.replace(/^\./, '').toLowerCase();

        if (!SUPPORTED_VIDEO_FORMATS.test(normalizedFormat)) {
            return respondError('Unsupported video format');
        }

        const outputFile = await convertFormat(videoPath, normalizedFormat);

        return respondSuccess('Video format conversion started successfully', outputFile);
    } catch (e) {
        return respondError(e?.message || e);
    }
};
/**
 * Stops an active video format conversion process.
 *
 * @param {string} processId
 * @returns {Object}
 */
const stopVideoFormatConversionService = (processId = '') => {
    try {
        if (!processId || typeof processId !== 'string') {
            return respondError('Invalid conversion process id');
        }

        stopConversion(processId);
        return respondSuccess('Video format conversion stopped successfully');
    } catch (e) {
        return respondError(e?.message || e);
    }
};

/**
 * Stops an active video optimization process.
 *
 * @param {string} processId
 * @returns {Object}
 */
const stopVideoOptimizationService = (processId = '') => {
    try {
        if (!processId || typeof processId !== 'string') {
            return respondError('Invalid optimization process id');
        }

        stopOptimization(processId);
        return respondSuccess('Video optimization stopped successfully');
    } catch (e) {
        return respondError(e?.message || e);
    }
};

/**
 * Starts video optimization with basic validation for source path and quality.
 *
 * @param {{ path?: string, quality?: string|number, destinationDir?: string }} config
 * @returns {Promise<Object>}
 */
const startVideoOptimizationService = async (config = {}) => {
    try {
        const { path, quality, destinationDir = '' } = config;
        const normalizedQuality = parseInt(quality, 10);

        if (!path || typeof path !== 'string' || path.trim() === '') {
            return respondError('Invalid video path');
        }

        if (Number.isNaN(normalizedQuality)) {
            return respondError('Invalid optimization quality');
        }

        if (destinationDir !== '' && typeof destinationDir !== 'string') {
            return respondError('Invalid destination directory');
        }

        const outputFile = await optimizeVideo({
            sourcePath: path,
            quality: normalizedQuality,
            destinationDir,
        });

        return respondSuccess('Video optimized successfully', outputFile);
    } catch (e) {
        return respondError(e?.message || e);
    }
};

/**
 * Starts video resizing with basic validation for source path and dimensions.
 *
 * @param {{ path?: string, width?: string|number, height?: string|number }} config
 * @returns {Promise<Object>}
 */
const startVideoResizeService = async (config = {}) => {
    try {
        const { path, width, height } = config;
        const normalizedWidth = parseInt(width, 10);
        const normalizedHeight = parseInt(height, 10);

        if (!path || typeof path !== 'string' || path.trim() === '') {
            return respondError('Invalid video path');
        }

        if (Number.isNaN(normalizedWidth) || normalizedWidth <= 0) {
            return respondError('Invalid resize width');
        }

        if (Number.isNaN(normalizedHeight) || normalizedHeight <= 0) {
            return respondError('Invalid resize height');
        }

        const outputFile = await resizeVideo({
            sourcePath: path,
            width: normalizedWidth,
            height: normalizedHeight,
        });

        return respondSuccess('Video resizing completed successfully', outputFile);
    } catch (e) {
        return respondError(e?.message || e);
    }
};

/**
 * Stops an active video resize process.
 *
 * @param {string} processId
 * @returns {Object}
 */
const stopVideoResizeService = (processId = '') => {
    try {
        if (!processId || typeof processId !== 'string') {
            return respondError('Invalid resize process id');
        }

        stopResize(processId);
        return respondSuccess('Video resize stopped successfully.');
    } catch (e) {
        return respondError(e?.message || e);
    }
};

module.exports = {
    startVideoFormatConversionService,
    stopVideoFormatConversionService,
    startVideoResizeService,
    stopVideoResizeService,
    startVideoOptimizationService,
    stopVideoOptimizationService,
};
