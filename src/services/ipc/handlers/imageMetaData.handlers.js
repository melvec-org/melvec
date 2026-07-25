const serviceMethods = require('../../../constants/serviceMethods');
const {
    setImageDescriptionService,
    generateImageDescriptionService,
    stopGeneratingImageDescriptionService,
    getImageMetaDataDetailsService,
    startImageMetaDataBatchGenerationService,
    stopBatchImageMetaDataGenerationService,
} = require('../../image-metadata/imageMetaData.service');

const imageMetaDataServiceHandlers = [
    [serviceMethods.IMAGE_META_DATA_SET_DESCRIPTION, async (imageId, desc) => setImageDescriptionService(imageId, desc)],
    [serviceMethods.IMAGE_META_DATA_GET_DETAILS, async (imageId) => getImageMetaDataDetailsService(imageId)],
    [
        serviceMethods.IMAGE_META_DATA_GENERATE_DESCRIPTION,
        async (imageId, shouldGenerateTitle) => generateImageDescriptionService(imageId, shouldGenerateTitle),
    ],
    [serviceMethods.IMAGE_META_DATA_STOP_GENERATING_DESCRIPTION, async (imageId) => stopGeneratingImageDescriptionService(imageId)],
    [serviceMethods.IMAGE_META_DATA_START_BATCH_GENERATION, async () => startImageMetaDataBatchGenerationService()],
    [serviceMethods.IMAGE_META_DATA_STOP_BATCH_GENERATION, async () => stopBatchImageMetaDataGenerationService()],
];

module.exports = {
    imageMetaDataServiceHandlers,
};
