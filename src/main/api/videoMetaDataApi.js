const serviceMethods = require('../../constants/serviceMethods');

const videoMetaDataApi = (ipcRenderer) => ({
    getVideoMetaDataDetails: (videoId) => ipcRenderer.invoke(serviceMethods.VIDEO_META_DATA_GET_DETAILS, videoId),
    generateVideoDescription: (videoId, shouldGenerateTitle) =>
        ipcRenderer.invoke(serviceMethods.VIDEO_META_DATA_GENERATE_DESCRIPTION, videoId, shouldGenerateTitle),
    stopGeneratingVideoDescription: (videoId) => ipcRenderer.invoke(serviceMethods.VIDEO_META_DATA_STOP_GENERATING_DESCRIPTION, videoId),
    setVideoDescription: (videoId, desc) => ipcRenderer.invoke(serviceMethods.VIDEO_META_DATA_SET_DESCRIPTION, videoId, desc),
    getShortDescription: (videoId) => ipcRenderer.invoke(serviceMethods.VIDEO_META_DATA_GET_SHORT_DESCRIPTION, videoId),
    generateTranscript: (videoId) => ipcRenderer.invoke(serviceMethods.VIDEO_META_DATA_GENERATE_TRANSCRIPT, videoId),
    startBatchVideoMetaDataGeneration: (videoIds) =>
        ipcRenderer.invoke(serviceMethods.VIDEO_META_DATA_START_BATCH_DESCRIPTION_GENERATION, videoIds),
    stopBatchVideoMetaDataGeneration: (videoIds) =>
        ipcRenderer.invoke(serviceMethods.VIDEO_META_DATA_STOP_BATCH_DESCRIPTION_GENERATION, videoIds),
});
module.exports = { videoMetaDataApi };
