const serviceMethods = require('../../../constants/serviceMethods');
const {
    addNewPlaylistService,
    removePlaylistService,
    removeVideoFromPlaylistService,
    getMostUsedPlaylists,
    getPlaylistDetails,
    renamePlaylistService,
    reorderVideosInPlaylistService,
} = require('../../playlists/playlist.service');

const { getLastUsedPlaylists } = require('../../history/actionHistory.service');

const playlistServiceHandlers = [
    [serviceMethods.PLAYLIST_ADD_NEW, async (playlist) => addNewPlaylistService(playlist)],
    [serviceMethods.PLAYLIST_REMOVE, async (playlist) => removePlaylistService(playlist)],
    [serviceMethods.PLAYLIST_GET_MOST_USED, async () => getMostUsedPlaylists()],
    [serviceMethods.PLAYLIST_GET_LAST_USED, async () => getLastUsedPlaylists()],
    [serviceMethods.PLAYLIST_RENAME, (playlistId, newLabel) => renamePlaylistService(playlistId, newLabel)],
    [serviceMethods.PLAYLIST_GET_DETAILS, async (playlistId = '') => getPlaylistDetails(playlistId)],
    [serviceMethods.PLAYLIST_REMOVE_VIDEO, async (playlistId, videoId) => removeVideoFromPlaylistService(playlistId, videoId)],
    [
        serviceMethods.PLAYLIST_REORDER_VIDEOS,
        async (playlist, videoId, newPos) => reorderVideosInPlaylistService(playlist, videoId, newPos),
    ],
];
module.exports = { playlistServiceHandlers };
