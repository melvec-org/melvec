const { MAX_WATCH_HISTORY, MAX_TAG_USED_HISTORY, MAX_PLAYLIST_USED_HISTORY, MAX_SEARCHED_VIDEO_COUNT } = require('../../configs/appConfig');
const { writeJSONFile, checkAndCreateJsonFileSync } = require('../service-utils/fileUtils');
const { getDbPath, dbFileNames } = require('../servicePathConfig');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const debounce = require('../service-utils/debounce');
const sortByOccurenceAndIndex = require('../search/sortByOccurenceAndIndex');

let actionHistory = {};
let actionHistoryDbPath = '';
const DEBOUNCE_DELAY = 1000;

const defaultActionHistoryData = {
    videoWatchHistory: [],
    lastUsedTags: [],
    lastUsedPlaylists: [],
    searchedVideos: [],
};

const writeActionHistoryDb = () => {
    if (actionHistoryDbPath !== '') {
        writeJSONFile(actionHistoryDbPath, actionHistory);
    }
};

const saveActionHistory = debounce(writeActionHistoryDb, DEBOUNCE_DELAY);

// keep max 500 items in watch history
// check for existing videoId before adding
const addVideoToWatchHistory = (videoId) => {
    if (actionHistory.videoWatchHistory.includes(videoId)) {
        actionHistory.videoWatchHistory.splice(actionHistory.videoWatchHistory.indexOf(videoId), 1);
    } else if (actionHistory.videoWatchHistory.length >= MAX_WATCH_HISTORY) {
        actionHistory.videoWatchHistory.shift(); // remove the oldest item if reached the limit
    }

    actionHistory.videoWatchHistory.unshift(videoId);

    saveActionHistory();
};

const getWatchHistory = () => actionHistory.videoWatchHistory;
const clearWatchHistory = () => {
    actionHistory.videoWatchHistory = [];
    saveActionHistory();
};

const onVideoDelete = ({ videoId }) => {
    if (actionHistory.videoWatchHistory.includes(videoId)) {
        actionHistory.videoWatchHistory.splice(actionHistory.videoWatchHistory.indexOf(videoId), 1);
    }

    actionHistory.lastUsedTags = actionHistory.lastUsedTags.filter((tag) => tag.id !== videoId);

    actionHistory.lastUsedPlaylists = actionHistory.lastUsedPlaylists.filter((playlist) => playlist.id !== videoId);

    if (actionHistory.searchedVideos.includes(videoId)) {
        actionHistory.searchedVideos = actionHistory.searchedVideos.filter((id) => id !== videoId);
    }

    saveActionHistory();
};

// ======================  Tags =========================
const addToLastUsedTags = (newTag) => {
    const { lastUsedTags } = actionHistory || [];
    // Check if the tag already exists in the array
    const index = lastUsedTags.findIndex((existingTag) => existingTag.id === newTag.id);

    if (index === -1) {
        if (lastUsedTags.length >= MAX_TAG_USED_HISTORY) {
            lastUsedTags.pop();
        }
        // Add the new tag to the beginning of the array
        lastUsedTags.unshift(newTag);
    }

    actionHistory.lastUsedTags = lastUsedTags;
    saveActionHistory();
};

const removeFromLastUsedTags = (tagId) => {
    const { lastUsedTags } = actionHistory || [];
    const index = lastUsedTags.findIndex((tag) => tag.id === tagId);

    if (index !== -1) {
        lastUsedTags.splice(index, 1);
    }

    actionHistory.lastUsedTags = lastUsedTags;
    saveActionHistory();
};

const getLastUsedTagsList = () => {
    return actionHistory.lastUsedTags || [];
};

const clearAllActionHistory = () => {
    actionHistory = defaultActionHistoryData;

    saveActionHistory();
    return {
        status: 'success',
        message: 'Action history cleared successfully',
    };
};

// ====================== Playlists =========================
const addToLastUsedPlaylists = (newPlaylist) => {
    let { lastUsedPlaylists } = actionHistory;
    // Check if the playlist already exists in the array
    if (!lastUsedPlaylists) {
        lastUsedPlaylists = [];
    }

    const index = lastUsedPlaylists.findIndex((existingPlaylist) => existingPlaylist.id === newPlaylist.id);

    if (index === -1) {
        if (lastUsedPlaylists.length >= MAX_PLAYLIST_USED_HISTORY) {
            lastUsedPlaylists.pop();
        }
        // Add the new playlist to the beginning of the array
        lastUsedPlaylists.unshift(newPlaylist);
    }

    actionHistory.lastUsedPlaylists = lastUsedPlaylists;

    saveActionHistory();
};

const removeFromLastUsedPlaylists = (playlistId) => {
    const { lastUsedPlaylists } = actionHistory || [];
    const index = lastUsedPlaylists.findIndex((playlist) => playlist.id === playlistId);

    if (index !== -1) {
        lastUsedPlaylists.splice(index, 1);
    }

    actionHistory.lastUsedPlaylists = lastUsedPlaylists;
    saveActionHistory();
};

const getLastUsedPlaylists = () => {
    return actionHistory.lastUsedPlaylists || [];
};

const initActionHistoryService = (dbFileName = dbFileNames.ACTION_HISTORY) => {
    actionHistoryDbPath = getDbPath(dbFileName);
    actionHistory = checkAndCreateJsonFileSync(actionHistoryDbPath, defaultActionHistoryData);
    serviceEventBus.subscribe(interServiceEvents.DELETE_VIDEO, onVideoDelete);
};

// ===================== searched videos =========================

const addToSearchedVideos = (videoId) => {
    actionHistory.searchedVideos.push(videoId);

    if (actionHistory.searchedVideos.length > MAX_SEARCHED_VIDEO_COUNT) {
        actionHistory.searchedVideos.shift(); // remove the oldest item if reached the limit
    }
    saveActionHistory();
};

/**
 * Returns last x number of video ids searched
 * @param {*} maxCount
 * @returns array of video ids
 */
const getSearchedVideoHistory = (maxCount = 5) => {
    // return last maxCount searched videos
    const uniqueSearchHistory = Array(...new Set(actionHistory.searchedVideos));

    if (uniqueSearchHistory.length > 0) {
        const searchedVideos = uniqueSearchHistory.slice(-maxCount);
        return searchedVideos.reverse();
    }
    return [];
};

/**
 *
 * @returns array of video ids based on highest searched
 */
const getSearchedVideos = () => {
    return sortByOccurenceAndIndex(actionHistory.searchedVideos);
};

module.exports = {
    initActionHistoryService,
    addVideoToWatchHistory,
    getWatchHistory,
    clearWatchHistory,
    clearAllActionHistory,
    addToLastUsedTags,
    removeFromLastUsedTags,
    getLastUsedTagsList,

    addToLastUsedPlaylists,
    removeFromLastUsedPlaylists,
    getLastUsedPlaylists,

    addToSearchedVideos,
    getSearchedVideos,
    getSearchedVideoHistory,
};
