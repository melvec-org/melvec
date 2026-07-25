const serviceMethods = require('../../constants/serviceMethods');
const transcodingApi = (ipcRenderer) => ({
    startOptimizingVideo: (config) => ipcRenderer.invoke(serviceMethods.TRANSCODING_START_OPTIMIZING_VIDEO, config),
    stopOptimizingVideo: (processId) => ipcRenderer.invoke(serviceMethods.TRANSCODING_STOP_OPTIMIZING_VIDEO, processId),

    startResizingVideo: (config) => ipcRenderer.invoke(serviceMethods.TRANSCODING_START_RESIZING_VIDEO, config),
    stopResizingVideo: (processId) => ipcRenderer.invoke(serviceMethods.TRANSCODING_STOP_RESIZING_VIDEO, processId),

    startVideoFormatConversion: (config) => ipcRenderer.invoke(serviceMethods.TRANSCODING_START_VIDEO_FORMAT_CONVERSION, config),
    stopVideoFormatConversion: (processId) => ipcRenderer.invoke(serviceMethods.TRANSCODING_STOP_VIDEO_FORMAT_CONVERSION, processId),
});
module.exports = { transcodingApi };
