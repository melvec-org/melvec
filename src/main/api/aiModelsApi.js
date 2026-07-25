const serviceMethods = require('../../constants/serviceMethods');
const aiModelsApi = (ipcRenderer) => ({
    downloadAIModels: (modelTier) => ipcRenderer.invoke(serviceMethods.AI_MODELS_DOWNLOAD, modelTier),
    cancelDownloadAIModels: (modelTier) => ipcRenderer.invoke(serviceMethods.AI_MODELS_CANCEL_DOWNLOAD, modelTier),
    pauseDownloadAIModels: (modelTier) => ipcRenderer.invoke(serviceMethods.AI_MODELS_PAUSE_DOWNLOAD, modelTier),
    resumeDownloadAIModels: (modelTier) => ipcRenderer.invoke(serviceMethods.AI_MODELS_RESUME_DOWNLOAD, modelTier),
    checkForAIModelFiles: (modelTier) => ipcRenderer.invoke(serviceMethods.AI_MODELS_CHECK_FOR_MODEL_FILES, modelTier),
    deleteAIModelFiles: (modelTier) => ipcRenderer.invoke(serviceMethods.AI_MODELS_DELETE_MODEL_FILES, modelTier),
    importModelsFromManualDownload: (localPath) => ipcRenderer.invoke(serviceMethods.AI_MODELS_LOCAL_IMPORT, localPath),
});
module.exports = { aiModelsApi };
