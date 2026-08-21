const { systemApi } = require('./systemApi');
const { collectionApi } = require('./collectionApi');
const { watchFoldersApi } = require('./watchFoldersApi');
const { tagsApi } = require('./tagsApi');
const { playlistApi } = require('./playlistApi');
const { searchApi } = require('./searchApi');
const { videoLibraryApi } = require('./videoLibraryApi');
const { commonMediaApi } = require('./commonMediaApi');
const { imageMetaDataApi } = require('./imageMetaDataApi');
const { videoPreviewApi } = require('./videoPreviewApi');
const { importExportApi } = require('./importExportApi');
const { transcodingApi } = require('./transcodingApi');
const { aiModelsApi } = require('./aiModelsApi');
const { smartPlaylistApi } = require('./smartPlaylistsApi');
const { videoMetaDataApi } = require('./videoMetaDataApi');
const { imageLibraryApi } = require('./imageLibraryApi');
const { audioLibraryApi } = require('./audioLibraryApi');
const { audioMetaDataApi } = require('./audioMetaDataApi');
const { locationApi } = require('./locationApi');

const invokeApis = (ipcRenderer) => ({
    ...systemApi(ipcRenderer),
    ...collectionApi(ipcRenderer),
    ...watchFoldersApi(ipcRenderer),
    ...tagsApi(ipcRenderer),
    ...playlistApi(ipcRenderer),
    ...searchApi(ipcRenderer),
    ...videoLibraryApi(ipcRenderer),
    ...commonMediaApi(ipcRenderer),
    ...imageMetaDataApi(ipcRenderer),
    ...videoPreviewApi(ipcRenderer),
    ...importExportApi(ipcRenderer),
    ...transcodingApi(ipcRenderer),
    ...aiModelsApi(ipcRenderer),
    ...smartPlaylistApi(ipcRenderer),
    ...videoMetaDataApi(ipcRenderer),
    ...imageLibraryApi(ipcRenderer),
    ...audioLibraryApi(ipcRenderer),
    ...audioMetaDataApi(ipcRenderer),
    ...locationApi(ipcRenderer),
});

module.exports = {
    invokeApis,
};
