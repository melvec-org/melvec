const serviceMethods = require('../../constants/serviceMethods');
const smartPlaylistApi = (ipcRenderer) => ({
    getNewlyAddedVideosSmartList: () => ipcRenderer.invoke(serviceMethods.SMART_PLAYLIST_GET_NEWLY_ADDED),
    getMostPlayedVideosSmartList: () => ipcRenderer.invoke(serviceMethods.SMART_PLAYLIST_GET_MOST_PLAYED),
    getLeastPlayedVideosSmartList: () => ipcRenderer.invoke(serviceMethods.SMART_PLAYLIST_GET_LEAST_PLAYED),
    getMostSearchedVideosSmartList: () => ipcRenderer.invoke(serviceMethods.SMART_PLAYLIST_GET_MOST_SEARCHED),
    getRecentlyPlayedVideosSmartList: () => ipcRenderer.invoke(serviceMethods.SMART_PLAYLIST_GET_RECENTLY_PLAYED),
    getTopRatedVideosSmartList: () => ipcRenderer.invoke(serviceMethods.SMART_PLAYLIST_GET_TOP_RATED),
    getEchoesSmartList: () => ipcRenderer.invoke(serviceMethods.SMART_PLAYLIST_GET_ECHOES),
});
module.exports = { smartPlaylistApi };
