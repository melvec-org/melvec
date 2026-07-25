const serviceMethods = require('../../../constants/serviceMethods');
const { getFullImageDetailsService } = require('../..//image-library/imageLibrary.service');
const imageLibraryServiceHandlers = [[serviceMethods.IMAGE_GET_FULL_DETAILS, async (imageId) => getFullImageDetailsService(imageId)]];

module.exports = {
    imageLibraryServiceHandlers,
};
