const serviceMethods = require('../../../constants/serviceMethods');
const {
    downloadAIModelsService,
    cancelAIModelDownloadService,
    pauseAIModelDownloadService,
    resumeAIModelDownloadService,
    checkForModelFilesService,
    deleteModelFilesService,
    importModelsFromLocalPathService,
} = require('../../ai-models/aiModels.services');

const aiModelsServiceHandlers = [
    // ============ AI MODELS ===========
    [serviceMethods.AI_MODELS_DOWNLOAD, async (modelTier) => downloadAIModelsService(modelTier)],
    [serviceMethods.AI_MODELS_CANCEL_DOWNLOAD, async (modelTier) => cancelAIModelDownloadService(modelTier)],
    [serviceMethods.AI_MODELS_PAUSE_DOWNLOAD, async (modelTier) => pauseAIModelDownloadService(modelTier)],
    [serviceMethods.AI_MODELS_RESUME_DOWNLOAD, async (modelTier) => resumeAIModelDownloadService(modelTier)],
    [serviceMethods.AI_MODELS_CHECK_FOR_MODEL_FILES, async (modelTier) => checkForModelFilesService(modelTier)],
    [serviceMethods.AI_MODELS_DELETE_MODEL_FILES, async (modelTier) => deleteModelFilesService(modelTier)],
    [serviceMethods.AI_MODELS_LOCAL_IMPORT, async (localPath) => importModelsFromLocalPathService(localPath)],
];
module.exports = { aiModelsServiceHandlers };
