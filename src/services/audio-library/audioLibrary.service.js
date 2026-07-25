const interServiceEvents = require('../../events/interServiceEvents');
const { respond, respondSuccess } = require('../service-utils/sendToUI');
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
const serviceEventBus = require('../service-utils/serviceEventBus');
const indexingEvents = require('../../events/indexingEvents');

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

const removeAudioFromLibrary = async (audioId, initiator) => {
    if (initiator !== 'ENOENT') {
        const isDeleteSuccess = await deleteAudioDetails(audioId);

        if (!isDeleteSuccess) {
            return { status: 'failed', audioId };
        }
    }

    serviceEventBus.publish(interServiceEvents.DELETE_AUDIO, { audioId });
    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.AUDIO_DELETE, audioId });

    return { status: 'success', audioId };
};

module.exports = {
    initAudioLibraryService,
    getFullAudioDetailsService,
    getAudioDetailsService,
    getAllAudioIdsService,
    deleteAudioDetails,
    removeAudioFromLibrary,
    moveAudio,
    importAudioFromWatchedDirectory,
    updateAudioTitleService,
    updateAudioNsfwStatusService,
    updateAudioNsfwStatus,
    renameAudioFileService,
    resetAudiosMetaData,
};
