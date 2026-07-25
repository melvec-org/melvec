const serviceMethods = require('../../constants/serviceMethods');
const audioLibraryApi = (ipcRenderer) => ({
    getFullAudioDetails: (audioId) => ipcRenderer.invoke(serviceMethods.AUDIO_GET_FULL_DETAILS, audioId),
});
module.exports = { audioLibraryApi };
