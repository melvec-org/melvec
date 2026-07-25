const serviceMethods = require('../../../constants/serviceMethods');
const {
    setAudioDescriptionService,
    generateAudioDescriptionService,
    stopGeneratingAudioDescriptionService,
    getAudioMetaDataDetailsService,
    startAudioMetaDataBatchGenerationService,
    stopBatchAudioMetaDataGenerationService,
} = require('../../audio-metadata/audioMetaData.service');

const audioMetaDataServiceHandlers = [
    [serviceMethods.AUDIO_META_DATA_SET_DESCRIPTION, async (audioId, desc) => setAudioDescriptionService(audioId, desc)],
    [serviceMethods.AUDIO_META_DATA_GET_DETAILS, async (audioId) => getAudioMetaDataDetailsService(audioId)],
    [
        serviceMethods.AUDIO_META_DATA_GENERATE_DESCRIPTION,
        async (audioId, shouldGenerateTitle) => generateAudioDescriptionService(audioId, shouldGenerateTitle),
    ],
    [serviceMethods.AUDIO_META_DATA_STOP_GENERATING_DESCRIPTION, async (audioId) => stopGeneratingAudioDescriptionService(audioId)],
    [serviceMethods.AUDIO_META_DATA_START_BATCH_GENERATION, async () => startAudioMetaDataBatchGenerationService()],
    [serviceMethods.AUDIO_META_DATA_STOP_BATCH_GENERATION, async () => stopBatchAudioMetaDataGenerationService()],
];

module.exports = {
    audioMetaDataServiceHandlers,
};
