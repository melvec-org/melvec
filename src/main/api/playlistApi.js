const serviceMethods = require('../../constants/serviceMethods');

const playlistApi = (ipcRenderer) => ({
    addNewPlaylist: (playlist) => ipcRenderer.invoke(serviceMethods.PLAYLIST_ADD_NEW, playlist),
    removePlaylist: (playlistId) => ipcRenderer.invoke(serviceMethods.PLAYLIST_REMOVE, playlistId),
    renamePlaylist: (playlistId, newLabel) => ipcRenderer.invoke(serviceMethods.PLAYLIST_RENAME, playlistId, newLabel),
    reorderVideosInPlaylist: (playlist, videoId, newPos) =>
        ipcRenderer.invoke(serviceMethods.PLAYLIST_REORDER_VIDEOS, playlist, videoId, newPos),
    removeVideoFromPlaylist: (playlistId, videoId) => ipcRenderer.invoke(serviceMethods.PLAYLIST_REMOVE_VIDEO, playlistId, videoId),
    getPlaylistDetails: (playlistId) => ipcRenderer.invoke(serviceMethods.PLAYLIST_GET_DETAILS, playlistId),
    getLastUsedPlaylists: () => ipcRenderer.invoke(serviceMethods.PLAYLIST_GET_LAST_USED),
    getMostUsedPlaylists: () => ipcRenderer.invoke(serviceMethods.PLAYLIST_GET_MOST_USED),
});
module.exports = { playlistApi };
