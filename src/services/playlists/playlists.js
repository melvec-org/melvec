const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');

const {
    initializeDb,
    getPlaylists,
    getPlaylistById,
    getVideosByPlaylist,
    getVideoIdsByPlaylist,
    getPlaylistsByVideoId,
    addVideoToPlaylist,
    addPlaylist,
    removeVideoFromPlaylist,
    removePlaylistById,
    cleanupVideoFromPlaylists,
    renamePlaylistById,
} = require('../database/playlistsDbService');

const addNewPlaylist = (id, label) => {
    addPlaylist(id, label);

    return getPlaylists();
};

const removePlaylist = (playlist = {}) => {
    if (playlist.id) {
        removePlaylistById(playlist.id);
        return getPlaylists();
    } else {
        return null;
    }
};

const renamePlaylist = (playlistId, newLabel) => {
    renamePlaylistById(playlistId, newLabel);

    return getPlaylists();
};

const getMostUsedPlaylists = () => {
    let playlistsWithItemCount = [];

    const playlists = getPlaylists();

    playlists.forEach((playlist) => {
        const videosLen = getVideoIdsByPlaylist(playlist.id).length || 0;
        playlistsWithItemCount.push({ playlistId: playlist.id, len: videosLen });
    });

    playlistsWithItemCount = playlistsWithItemCount.sort((tag1, tag2) => (tag1.len < tag2.len ? 1 : tag1.len > tag2.len ? -1 : 0));

    playlistsWithItemCount = playlistsWithItemCount.slice(0, 10);

    return playlistsWithItemCount.map((item) => getPlaylistById(item.playlistId));
};

const onVideoDelete = ({ videoId }) => cleanupVideoFromPlaylists(videoId);

const initPlaylistsService = () => {
    initializeDb();

    serviceEventBus.subscribe(interServiceEvents.DELETE_VIDEO, onVideoDelete);
};

module.exports = {
    initPlaylistsService,
    getPlaylists,
    getVideosByPlaylist,
    getPlaylistsByVideoId,
    getMostUsedPlaylists,
    getVideoIdsByPlaylist,

    // add operations
    addNewPlaylist,
    addVideoToPlaylist,

    // remove operations
    removePlaylist,
    removeVideoFromPlaylist,

    renamePlaylist,
};
