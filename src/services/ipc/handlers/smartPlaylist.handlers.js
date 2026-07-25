const serviceMethods = require('../../../constants/serviceMethods');
const {
    getNewlyAddedVideosSmartList,
    getMostPlayedVideosSmartList,
    getLeastPlayedVideosSmartList,
    getMostSearchedVideosSmartList,
    getRecentlyPlayedVideosSmartList,
    getTopRatedVideosSmartList,
    getEchoesSmartList,
} = require('../../smart-playlists/smartPlaylists.service');

const smartPlaylistServiceHandlers = [
    [serviceMethods.SMART_PLAYLIST_GET_ECHOES, async () => getEchoesSmartList()],
    [serviceMethods.SMART_PLAYLIST_GET_TOP_RATED, async () => getTopRatedVideosSmartList()],
    [serviceMethods.SMART_PLAYLIST_GET_NEWLY_ADDED, async () => getNewlyAddedVideosSmartList()],
    [serviceMethods.SMART_PLAYLIST_GET_MOST_PLAYED, async () => getMostPlayedVideosSmartList()],
    [serviceMethods.SMART_PLAYLIST_GET_LEAST_PLAYED, async () => getLeastPlayedVideosSmartList()],
    [serviceMethods.SMART_PLAYLIST_GET_MOST_SEARCHED, async () => getMostSearchedVideosSmartList()],
    [serviceMethods.SMART_PLAYLIST_GET_RECENTLY_PLAYED, async () => getRecentlyPlayedVideosSmartList()],
];

module.exports = { smartPlaylistServiceHandlers };
