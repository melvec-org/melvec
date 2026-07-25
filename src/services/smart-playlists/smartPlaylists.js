const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const debounce = require('../service-utils/debounce');

const { SMART_PLAYLIST_VIDEO_COUNTS } = require('../../configs/appConfig');
const deepEqual = require('../service-utils/deepEqual');
const sortByProp = require('../service-utils/sortByProp');
const { getVideoMetricsByVideoId } = require('../video-metrics/videoMetrics');
const smartPlaylistsDbService = require('../database/smartPlaylistsDbService');

const DEBOUNCE_DELAY = 2000;

// Echoes are ephemeral (recalculated daily from the video library) so they
// are never persisted — only the keys below are written to SQLite.
const PERSISTED_KEYS = [
    'leastPlayedVideos',
    'mostPlayedVideos',
    'mostSearchedVideos',
    'newlyAddedVideos',
    'recentlyPlayedVideos',
    'topRatedVideos',
];

const defaultSmartPlaylistData = {
    leastPlayedVideos: [],
    mostPlayedVideos: [],
    mostSearchedVideos: [],
    newlyAddedVideos: [],
    recentlyPlayedVideos: [],
    topRatedVideos: [],
    echoes: [],
};

let smartPlaylistData = {};

const updateSmartPlaylistDb = () => {
    const payload = {};
    for (const key of PERSISTED_KEYS) {
        payload[key] = smartPlaylistData[key] || [];
    }
    smartPlaylistsDbService.setPlaylists(payload);
};

const debouncedUpdateDb = debounce(updateSmartPlaylistDb, DEBOUNCE_DELAY);

/** =================== least played videos ==================*/
const updateLeastPlayedVideos = (videosArr = []) => {
    const topUnwatchVideos = videosArr.slice(0, SMART_PLAYLIST_VIDEO_COUNTS);

    if (!deepEqual(smartPlaylistData.leastPlayedVideos, topUnwatchVideos)) {
        smartPlaylistData.leastPlayedVideos = topUnwatchVideos;
        debouncedUpdateDb();
    }
    return smartPlaylistData.leastPlayedVideos;
};

const getLeastPlayedVideos = () => smartPlaylistData.leastPlayedVideos;

/** --================================== most played videos ================================-- */

const getMostPlayedVideos = () => smartPlaylistData.mostPlayedVideos || [];

const updateMostPlayedVideos = (videoArr = []) => {
    const sortedPlayedVideos = videoArr;

    const topPlayedVideos = sortedPlayedVideos.slice(0, SMART_PLAYLIST_VIDEO_COUNTS);

    if (!deepEqual(smartPlaylistData.mostPlayedVideos, topPlayedVideos)) {
        smartPlaylistData.mostPlayedVideos = topPlayedVideos;
        debouncedUpdateDb();
    }
    return smartPlaylistData.mostPlayedVideos;
};

/** ======================================= last played videos ============================== */

const getRecentlyPlayedVideos = () => smartPlaylistData.recentlyPlayedVideos.reverse();

const updateRecentlyPlayedVideos = (lastPlayedVideos = []) => {
    const capped = lastPlayedVideos.slice(0, SMART_PLAYLIST_VIDEO_COUNTS);
    smartPlaylistData.recentlyPlayedVideos = [...capped].reverse();

    debouncedUpdateDb();
};

/** ==================================== Newly added video ========================== */

const getNewlyAddedVideos = () => smartPlaylistData.newlyAddedVideos;

const updateNewlyAddedVideos = (videos = []) => {
    // Start from what is already persisted so incremental imports accumulate correctly
    const existingIds = smartPlaylistData.newlyAddedVideos || [];
    let newlyAddedVideos = existingIds.map((id) => ({ id, birthtimeMs: 0 }));

    videos = videos.map((item) => {
        return {
            id: item.id,
            birthtimeMs: item.birthtimeMs,
        };
    });

    for (let i = 0; i < videos.length; i++) {
        const item = videos[i];
        const isDuplicate = newlyAddedVideos.find((video) => video.id === item.id);
        if (isDuplicate === undefined) {
            const lastVideoBirthTime = newlyAddedVideos[newlyAddedVideos.length - 1]
                ? newlyAddedVideos[newlyAddedVideos.length - 1]['birthtimeMs']
                : 0;

            if (newlyAddedVideos.length < SMART_PLAYLIST_VIDEO_COUNTS || item.birthtimeMs > lastVideoBirthTime) {
                newlyAddedVideos.push(item);
                newlyAddedVideos = sortByProp(newlyAddedVideos, 'birthtimeMs');
                newlyAddedVideos = newlyAddedVideos.slice(0, SMART_PLAYLIST_VIDEO_COUNTS);
            }
        }
    }
    smartPlaylistData.newlyAddedVideos = newlyAddedVideos.map((item) => item.id);

    debouncedUpdateDb();
};

/** ========================= most searched videos ========================== */

const getMostSearchedVideos = () => smartPlaylistData.mostSearchedVideos;

const updateMostSearchedVideos = (searchStats = []) => {
    smartPlaylistData.mostSearchedVideos = searchStats.slice(0, SMART_PLAYLIST_VIDEO_COUNTS);
    debouncedUpdateDb();
};

/** ========================= top rated video ========================== */

const getTopRatedVideos = () => smartPlaylistData.topRatedVideos;

const updateTopRatedVideos = (videosArr = []) => {
    // Todo put the logic to find toprated ones
    smartPlaylistData.topRatedVideos = videosArr.slice(0, SMART_PLAYLIST_VIDEO_COUNTS);
    debouncedUpdateDb();
};

/** ========================= Echoes  */

// echoes are not to be stored, but kept in memory as they keep on changing on everyday basis
const getEchoes = () => smartPlaylistData.echoes;

/**
 *
 * Source: ISO 8601 week date system
 * @param {*} date
 * @returns
 */
const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};

const getTopNMostViewedVideos = (videos, n = 20) => {
    const videosWithMeta = videos
        .map((item) => {
            return {
                id: item,
                views: getVideoMetricsByVideoId(item)?.views || 0,
            };
        })
        .filter((item) => item.views > 0)
        .sort((a, b) => b.views - a.views)
        .map((item) => item.id);

    return videosWithMeta.slice(0, n);
};
// this scanns all videos that were created last year or previous year on the same week as today
const populateEchoes = (videos = []) => {
    if (videos.length === 0) {
        smartPlaylistData.echoes = [];
        return [];
    }

    const currentDate = new Date();
    const currentWeekNumber = getWeekNumber(currentDate);
    const currentYear = currentDate.getFullYear();

    const echoesMap = new Map();

    for (const v of videos) {
        const videoYear = parseInt(v.year);
        if (!videoYear || videoYear >= currentYear) continue;

        const birthDate = v.birthtimeMs ? new Date(v.birthtimeMs) : null;
        if (!birthDate) continue;

        const videoWeekNumber = getWeekNumber(birthDate);
        if (videoWeekNumber === currentWeekNumber) {
            if (!echoesMap.has(videoYear)) {
                echoesMap.set(videoYear, []);
            }
            echoesMap.get(videoYear).push(v.id);
        }
    }

    // Step 2: Convert the map to a sorted array of objects (descending year)
    const echoes = Array.from(echoesMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([year, vids]) => ({ year, videos: getTopNMostViewedVideos(vids) }));

    smartPlaylistData.echoes = echoes;

    return echoes;
};

const onVideoDelete = ({ videoId }) => {
    if (!videoId) return;
    // SQLite CASCADE already deleted the rows from smart_playlist_videos.
    // Just keep the in-memory cache consistent.
    for (const key of PERSISTED_KEYS) {
        smartPlaylistData[key] = (smartPlaylistData[key] || []).filter((id) => id !== videoId);
    }
    // TODO - fix in the object.
    smartPlaylistData.echoes = smartPlaylistData.echoes
        .map((group) => ({ ...group, videos: group.videos.filter((id) => id !== videoId) }))
        .filter((group) => group.videos.length > 0);
};

const initSmartPlaylistsService = () => {
    smartPlaylistsDbService.initializeDb();

    // Load persisted playlists from SQLite; fall back to empty arrays for any missing key
    const persisted = smartPlaylistsDbService.getAllPlaylists();
    smartPlaylistData = { ...defaultSmartPlaylistData, ...persisted };

    serviceEventBus.subscribe(interServiceEvents.IMPORT_FILE_SUCCESS, (data) => {
        if (data.completedMediaStats) {
            updateNewlyAddedVideos([data.completedMediaStats]);
        }
    });
    serviceEventBus.subscribe(interServiceEvents.REFRESH_VIDEO_LIBRARY, (videosArr) => {
        // updateRecentlyAddedVideos(videosArr);
    });

    serviceEventBus.subscribe(interServiceEvents.DELETE_VIDEO, onVideoDelete);
};

module.exports = {
    initSmartPlaylistsService,
    getLeastPlayedVideos,
    updateLeastPlayedVideos,

    // most played
    getMostPlayedVideos,
    updateMostPlayedVideos,

    //
    getRecentlyPlayedVideos,
    updateRecentlyPlayedVideos,

    // most searched video
    getMostSearchedVideos,
    updateMostSearchedVideos,

    // newly added video
    getNewlyAddedVideos,
    updateNewlyAddedVideos,

    // top rated video
    getTopRatedVideos,
    updateTopRatedVideos,

    populateEchoes,
    getEchoes,
};
