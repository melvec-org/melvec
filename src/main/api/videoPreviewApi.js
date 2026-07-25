const serviceMethods = require('../../constants/serviceMethods');
const videoPreviewApi = (ipcRenderer) => ({
    startBatchVideoPreviewGeneration: () => ipcRenderer.invoke(serviceMethods.VIDEO_PREVIEW_START_BATCH_GENERATION),
    stopBatchVideoPreviewGeneration: () => ipcRenderer.invoke(serviceMethods.VIDEO_PREVIEW_STOP_BATCH_GENERATION),
    getPendingVideoPreviewCount: () => ipcRenderer.invoke(serviceMethods.VIDEO_PREVIEW_GET_PENDING_COUNT),
    clearAllVideoPreviews: () => ipcRenderer.invoke(serviceMethods.VIDEO_PREVIEW_CLEAR_ALL),
});
module.exports = { videoPreviewApi };
