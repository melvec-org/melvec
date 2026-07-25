const serviceMethods = require('../../../constants/serviceMethods');
const { getFullAudioDetailsService } = require('../../audio-library/audioLibrary.service');
const audioLibraryServiceHandlers = [[serviceMethods.AUDIO_GET_FULL_DETAILS, async (audioId) => getFullAudioDetailsService(audioId)]];

module.exports = {
    audioLibraryServiceHandlers,
};
