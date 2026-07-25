const serviceMethods = require('../../constants/serviceMethods');

const imageMetaDataApi = (ipcRenderer) => ({
    setImageDescription: (imageId, desc) => ipcRenderer.invoke(serviceMethods.IMAGE_META_DATA_SET_DESCRIPTION, imageId, desc),
    getImageMetaDataDetails: (imageId) => ipcRenderer.invoke(serviceMethods.IMAGE_META_DATA_GET_DETAILS, imageId),
    generateImageDescription: (imageId, shouldGenerateTitle) =>
        ipcRenderer.invoke(serviceMethods.IMAGE_META_DATA_GENERATE_DESCRIPTION, imageId, shouldGenerateTitle),
    stopGeneratingImageDescription: (imageId) => ipcRenderer.invoke(serviceMethods.IMAGE_META_DATA_STOP_GENERATING_DESCRIPTION, imageId),
    startImageMetaDataBatchGeneration: () => ipcRenderer.invoke(serviceMethods.IMAGE_META_DATA_START_BATCH_GENERATION),
    stopImageMetaDataBatchGeneration: () => ipcRenderer.invoke(serviceMethods.IMAGE_META_DATA_STOP_BATCH_GENERATION),
});
module.exports = { imageMetaDataApi };
