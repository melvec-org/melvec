const { registerIpcHandler } = require('../service-utils/ipcHandler');

const { aiModelsServiceHandlers } = require('./handlers/aiModels.handlers');
const { collectionServiceHandlers } = require('./handlers/collection.handlers');
const { videoLibraryServiceHandlers } = require('./handlers/videoLibrary.handlers');
const { videoPreviewServiceHandlers } = require('./handlers/videoPreview.handlers');
const { systemServiceHandlers } = require('./handlers/system.handlers');
const { playlistServiceHandlers } = require('./handlers/playlist.handlers');

const { tagsServiceHandlers } = require('./handlers/tags.handlers');
const { transcodingServiceHandlers } = require('./handlers/transcoding.handlers');
const { watchFolderServiceHandlers } = require('./handlers/watchFolders.handlers');
const { smartPlaylistServiceHandlers } = require('./handlers/smartPlaylist.handlers');
const { videoMetaDataServiceHandlers } = require('./handlers/videoMetaData.handlers');
const { importExportServiceHandlers } = require('./handlers/importExport.handlers');
const { commonMediaServiceHandlers } = require('./handlers/commonMedia.handlers');
const { searchServiceHandlers } = require('./handlers/search.handlers');
const { imageLibraryServiceHandlers } = require('./handlers/imageLibrary.handlers');
const { imageMetaDataServiceHandlers } = require('./handlers/imageMetaData.handlers');
const { audioLibraryServiceHandlers } = require('./handlers/audioLibrary.handlers');
const { audioMetaDataServiceHandlers } = require('./handlers/audioMetaData.handlers');
const { locationServiceHandlers } = require('./handlers/location.handlers');

const registerHandlers = () => {
    const handlers = [
        ...aiModelsServiceHandlers,
        ...collectionServiceHandlers,
        ...videoLibraryServiceHandlers,
        ...videoPreviewServiceHandlers,
        ...systemServiceHandlers,
        ...playlistServiceHandlers,
        ...tagsServiceHandlers,
        ...transcodingServiceHandlers,
        ...watchFolderServiceHandlers,
        ...smartPlaylistServiceHandlers,
        ...videoMetaDataServiceHandlers,
        ...importExportServiceHandlers,
        ...commonMediaServiceHandlers,
        ...searchServiceHandlers,
        ...imageLibraryServiceHandlers,
        ...imageMetaDataServiceHandlers,
        ...audioLibraryServiceHandlers,
        ...audioMetaDataServiceHandlers,
        ...locationServiceHandlers,
    ];

    handlers.forEach(([name, handler]) => {
        registerIpcHandler(name, handler, true);
    });
};

module.exports = {
    registerHandlers,
};
