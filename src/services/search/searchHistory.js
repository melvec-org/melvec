const mediaTypes = require('../../constants/mediaTypes');
const {
    initializeSearchHistoryDbService,
    deleteSearchHistoryByLabel,
    getSearchHistory,
    clearSearchHistory,
    addToSearchHistory: dbAddToSearchHistory,
    getSearchHistoryByOccurenceAndTime,
} = require('../database/searchHistoryDbService');

const { addToSearchedVideos, getSearchedVideos } = require('../history/actionHistory');

const addToSearchHistory = (keyword, selectedItem) => {
    if (keyword) {
        dbAddToSearchHistory(keyword);
    }

    if (selectedItem && selectedItem.id) {
        if (selectedItem.mediaType === mediaTypes.VIDEO) {
            addToSearchedVideos(selectedItem.id);
        }
    }
};

const getIndexedSearchHistory = () => getSearchHistoryByOccurenceAndTime();

const deleteSearchHistoryItem = (keyword) => deleteSearchHistoryByLabel(keyword);

const initSearchHistoryService = () => {
    initializeSearchHistoryDbService();
};

module.exports = {
    initSearchHistoryService,
    addToSearchHistory,
    getSearchHistory,
    getIndexedSearchHistory,
    clearSearchHistory,
    getSearchedVideos,
    deleteSearchHistoryItem,
};
