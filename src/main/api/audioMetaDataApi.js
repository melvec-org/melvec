const serviceMethods = require('../../constants/serviceMethods');

const audioMetaDataApi = (ipcRenderer) => ({
    setAudioDescription: (audioId, desc) => ipcRenderer.invoke(serviceMethods.AUDIO_META_DATA_SET_DESCRIPTION, audioId, desc),
    getAudioMetaDataDetails: (audioId) => ipcRenderer.invoke(serviceMethods.AUDIO_META_DATA_GET_DETAILS, audioId),
    generateAudioDescription: (audioId, shouldGenerateTitle) =>
        ipcRenderer.invoke(serviceMethods.AUDIO_META_DATA_GENERATE_DESCRIPTION, audioId, shouldGenerateTitle),
    stopGeneratingAudioDescription: (audioId) => ipcRenderer.invoke(serviceMethods.AUDIO_META_DATA_STOP_GENERATING_DESCRIPTION, audioId),
    startAudioMetaDataBatchGeneration: () => ipcRenderer.invoke(serviceMethods.AUDIO_META_DATA_START_BATCH_GENERATION),
    stopAudioMetaDataBatchGeneration: () => ipcRenderer.invoke(serviceMethods.AUDIO_META_DATA_STOP_BATCH_GENERATION),
});
module.exports = { audioMetaDataApi };
