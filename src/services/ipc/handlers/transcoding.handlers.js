const serviceMethods = require('../../../constants/serviceMethods');
const {
    startVideoOptimizationService,
    stopVideoOptimizationService,
    stopVideoFormatConversionService,
    startVideoFormatConversionService,
    stopVideoResizeService,
    startVideoResizeService,
} = require('../..//video-transcoding/videoTranscoding.service');

const transcodingServiceHandlers = [
    [serviceMethods.TRANSCODING_START_OPTIMIZING_VIDEO, async (config) => startVideoOptimizationService(config)],
    [serviceMethods.TRANSCODING_STOP_OPTIMIZING_VIDEO, async (processId) => stopVideoOptimizationService(processId)],
    [serviceMethods.TRANSCODING_START_RESIZING_VIDEO, async (config) => startVideoResizeService(config)],
    [serviceMethods.TRANSCODING_STOP_RESIZING_VIDEO, async (processId) => stopVideoResizeService(processId)],
    [serviceMethods.TRANSCODING_START_VIDEO_FORMAT_CONVERSION, async (config) => startVideoFormatConversionService(config)],
    [serviceMethods.TRANSCODING_STOP_VIDEO_FORMAT_CONVERSION, async (processId) => stopVideoFormatConversionService(processId)],
];

module.exports = {
    transcodingServiceHandlers,
};
