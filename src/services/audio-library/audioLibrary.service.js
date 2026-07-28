const responseStatus = require('../../constants/responseStatus');
const { respond, respondSuccess, respondError } = require('../service-utils/sendToUI');
const {
    initAudioLibraryService,
    getFullAudioDetailsById,
    getAllAudioIds,
    deleteAudioDetails,
    moveAudio,
    importAudioFromWatchedDirectory,
    updateAudioTitle,
    updateAudioNsfwStatus,
    renameAudioFile,
    resetAudiosMetaData,
} = require('./audioLibrary');

const getAudioDetailsService = (audioId) => {
    const audioDetails = getAudioDetailsById(audioId);
    return respondSuccess('audioDetails', audioDetails);
};

const getAllAudioIdsService = () => {
    return respondSuccess('audioIds', getAllAudioIds());
};

const updateAudioTitleService = (audioId, title) => {
    try {
        const updatedAudioDetails = updateAudioTitle(audioId, title);

        return respondSuccess('Title updated successfully', updatedAudioDetails);
    } catch (error) {
        return respond('error', `system error while updating. ${error.message}`);
    }
};

const updateAudioNsfwStatusService = (audioId, isNsfw) => {
    try {
        const updatedAudioDetails = updateAudioNsfwStatus(audioId, isNsfw);
        return respondSuccess('NSFW status updated successfully', updatedAudioDetails);
    } catch (error) {
        return respond('error', `system error while updating. ${error.message}`);
    }
};

const renameAudioFileService = (audioId, oldFileName, newFileName) => {
    return renameAudioFile(audioId, oldFileName, newFileName);
};

const getFullAudioDetailsService = (audioId) => {
    try {
        const audioDetails = getFullAudioDetailsById(audioId);

        return respondSuccess('audioDetails', audioDetails);
    } catch (error) {
        return respond('error', `system error while getting audio details. ${error.message}`);
    }
};

const removeAudioFromLibraryService = async (audioId, initiator) => {
    try {
        const deleteAction = await deleteAudioDetails(audioId, initiator);

        if (deleteAction.status === responseStatus.SUCCESS) {
            return respondSuccess('Audio file deleted successfully', deleteAction.audioId);
        } else {
            return respondFailure('Failed to delete audio file', deleteAction.message);
        }
    } catch (error) {
        return respondError(`Error: ${error.message}`);
    }
};

module.exports = {
    initAudioLibraryService,
    getFullAudioDetailsService,
    getAudioDetailsService,
    getAllAudioIdsService,
    deleteAudioDetails,
    removeAudioFromLibraryService,
    moveAudio,
    importAudioFromWatchedDirectory,
    updateAudioTitleService,
    updateAudioNsfwStatusService,
    updateAudioNsfwStatus,
    renameAudioFileService,
    resetAudiosMetaData,
};
