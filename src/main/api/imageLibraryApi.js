const serviceMethods = require('../../constants/serviceMethods');
const imageLibraryApi = (ipcRenderer) => ({
    getFullImageDetails: (imageId) => ipcRenderer.invoke(serviceMethods.IMAGE_GET_FULL_DETAILS, imageId),
});
module.exports = { imageLibraryApi };
