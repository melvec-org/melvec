const { getBasicVideoDetailsById } = require('../video-library/videoLibrary.service');
const {
    getMostSearchedVideos,
    getLeastPlayedVideos,
    getMostPlayedVideos,
    initSmartPlaylistsService,
    getNewlyAddedVideos,
    getRecentlyPlayedVideos,
    getTopRatedVideos,
    updateNewlyAddedVideos,
    populateEchoes,
    updateRecentlyPlayedVideos,
    updateLeastPlayedVideos,
    updateMostPlayedVideos,
    updateMostSearchedVideos,
    updateTopRatedVideos,
    getEchoes,
} = require('./smartPlaylists');
const { getWatchHistory, getSearchedVideos } = require('../history/actionHistory.service');
const { getMostViewedVideos } = require('../video-metrics/videoMetrics.service');
const { getTopRatedVideosList } = require('../video-metrics/videoMetrics.service');
const { respondSuccess, respondError } = require('../service-utils/sendToUI');

const { getAllVideoShortInfoFromDb } = require('../video-library/videoLibraryDbService');

const smartListGetMap = {
    mostSearched: getMostSearchedVideos,
    leastPlayed: getLeastPlayedVideos,
    mostPlayed: getMostPlayedVideos,
    newlyAdded: getNewlyAddedVideos,
    recentlyPlayed: getRecentlyPlayedVideos,
    topRated: getTopRatedVideos,
};
// common playlist fetcher
const _getSmartPlaylist = (playlistType) => {
    let videoIds = smartListGetMap[playlistType]();

    let videoList = [];

    if (videoIds && videoIds.length > 0) {
        videoList = videoIds.map((item) => getBasicVideoDetailsById(item));
    } else {
        videoList = [];
    }
    return respondSuccess('Video data', videoList);
};

const getMostSearchedVideosSmartList = () => _getSmartPlaylist('mostSearched');
const getLeastPlayedVideosSmartList = () => _getSmartPlaylist('leastPlayed');
const getMostPlayedVideosSmartList = () => _getSmartPlaylist('mostPlayed');
const getNewlyAddedVideosSmartList = () => _getSmartPlaylist('newlyAdded');
const getRecentlyPlayedVideosSmartList = () => _getSmartPlaylist('recentlyPlayed');
const getTopRatedVideosSmartList = () => _getSmartPlaylist('topRated');

const EMPTY_ECHOES_SMART_LIST = { period: null, mediaList: [] };

const getEchoesSmartListService = () => {
    try {
        const echoes = getEchoes();
        if (!echoes) {
            return respondSuccess('Echoes', EMPTY_ECHOES_SMART_LIST);
        }

        const echoesVideoList = {
            period: echoes.period,
            mediaList: echoes.mediaList.map((item) => {
                return {
                    year: item.year,
                    videos: item.videos.map((videoId) => getBasicVideoDetailsById(videoId)),
                };
            }),
        };
        return respondSuccess('Echoes', echoesVideoList);
    } catch (e) {
        return respondError('Failed to get the echoes');
    }
};

/**
 * This is fired explicitely to reindex all smart lists
 */
const forceUpdateSmartLists = () => {
    // updateNewlyAdded videos

    const allVideos = getAllVideoShortInfoFromDb();
    updateNewlyAddedVideos(allVideos);

    // update echoes

    populateEchoes(allVideos);

    // update recently played videos
    updateRecentlyPlayedVideos(getWatchHistory());

    const videoAndViews = getMostViewedVideos();
    // update most played videos
    updateMostPlayedVideos(videoAndViews.map((item) => item.video_id));

    // update least played videos
    const leastPlayedVideos = videoAndViews.map((item) => item.video_id).reverse();

    updateLeastPlayedVideos(leastPlayedVideos);

    // update most searched videos

    updateMostSearchedVideos(getSearchedVideos());

    const topRatedVideos = getTopRatedVideosList();
    updateTopRatedVideos(topRatedVideos.map((item) => item.video_id));
};

module.exports = {
    getNewlyAddedVideosSmartList,
    getMostPlayedVideosSmartList,
    getRecentlyPlayedVideosSmartList,
    getLeastPlayedVideosSmartList,
    getMostSearchedVideosSmartList,
    getTopRatedVideosSmartList,
    getEchoesSmartListService,
    forceUpdateSmartLists,
    initSmartPlaylistsService,
};
