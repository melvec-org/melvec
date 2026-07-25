const serviceMethods = require('../../../constants/serviceMethods');
const {
    generateVideoDescriptionService,
    generateTranscriptService,
    stopGeneratingVideoDescriptionService,
    setVideoMetaDataDescriptionService,
    startBatchVideoMetaDataGenerationService,
    stopBatchVideoMetaDataGenerationService,
    getVideoMetaDataDetails,
    getShortVideoDescriptionService,
} = require('../../video-metadata/videoMetaData.service');

const videoMetaDataServiceHandlers = [
    [
        serviceMethods.VIDEO_META_DATA_GENERATE_DESCRIPTION,
        async (videoId, shouldGenerateTitle) => generateVideoDescriptionService(videoId, shouldGenerateTitle),
    ],
    [serviceMethods.VIDEO_META_DATA_STOP_GENERATING_DESCRIPTION, async (videoId) => stopGeneratingVideoDescriptionService(videoId)],
    [
        serviceMethods.VIDEO_META_DATA_SET_DESCRIPTION,
        async (videoId, description) => setVideoMetaDataDescriptionService(videoId, description),
    ],
    [serviceMethods.VIDEO_META_DATA_GET_DETAILS, async (videoId) => getVideoMetaDataDetails(videoId)],
    [serviceMethods.VIDEO_META_DATA_GET_SHORT_DESCRIPTION, async (videoId) => getShortVideoDescriptionService(videoId)],
    [serviceMethods.VIDEO_META_DATA_GENERATE_TRANSCRIPT, async (videoId) => generateTranscriptService(videoId)],
    [
        serviceMethods.VIDEO_META_DATA_START_BATCH_DESCRIPTION_GENERATION,
        async (videoIds) => startBatchVideoMetaDataGenerationService(videoIds),
    ],
    [
        serviceMethods.VIDEO_META_DATA_STOP_BATCH_DESCRIPTION_GENERATION,
        async (videoIds) => stopBatchVideoMetaDataGenerationService(videoIds),
    ],
];
module.exports = {
    videoMetaDataServiceHandlers,
};
