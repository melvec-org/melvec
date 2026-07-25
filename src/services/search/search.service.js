const { getFullVideoDetailsById, getBasicVideoDetailsById } = require('../video-library/videoLibrary.service');
const { search, initSearch } = require('./search');
const {
    initSearchHistoryService,
    getSearchHistory,
    getIndexedSearchHistory,
    addToSearchHistory,
    clearSearchHistory,
    deleteSearchHistoryItem,
} = require('./searchHistory');
const { getSearchedVideoHistory } = require('../history/actionHistory');
const { respondFailure, respondSuccess } = require('../service-utils/sendToUI');
const mediaTypes = require('../../constants/mediaTypes');
const { getBasicImageDetailsById } = require('../image-library/imageLibrary');
const fillDetailsForSearchResults = (arr) => {
    return arr.map((item, index) => {
        let fleshedItem = null;
        if (item.mediaType === mediaTypes.VIDEO) {
            fleshedItem = getFullVideoDetailsById(item.id);
        } else if (item.mediaType === mediaTypes.IMAGE) {
            fleshedItem = getBasicImageDetailsById(item.id);
        }
        if (fleshedItem) {
            fleshedItem['relevance'] = index;
        }

        return fleshedItem;
    });
};

const getSearchResults = async (searchString, isQuickSearch, filters) => {
    const searchResults = await search(searchString, isQuickSearch, filters);

    if (!searchResults.isCached) {
        if (searchResults.byTags.length > 0) {
            searchResults.byTags = fillDetailsForSearchResults(searchResults.byTags);
        }
        if (searchResults.byTitles.length > 0) {
            searchResults.byTitles = fillDetailsForSearchResults(searchResults.byTitles);
        }
        if (searchResults.byFileNames.length > 0) {
            searchResults.byFileNames = fillDetailsForSearchResults(searchResults.byFileNames);
        }
        if (searchResults.byMetaData.length > 0) {
            searchResults.byMetaData = fillDetailsForSearchResults(searchResults.byMetaData);
        }
    }

    return searchResults;
};

const addToSearchHistoryService = (arg) => {
    if (arg.searchText || arg.selectedItem) {
        addToSearchHistory(arg.searchText, arg.selectedItem);
    }
};
const deleteSearchHistoryItemService = (arg) => {
    if (arg.searchText) {
        deleteSearchHistoryItem(arg.searchText);
    }
};

const clearSearchHistoryService = () => {
    try {
        clearSearchHistory();
        return respondSuccess('Search history cleared successfully.');
    } catch (e) {
        return respondFailure('Some problem in clearing the search history', e);
    }
};

const getSearchHistoryService = (limit = 5) => {
    const textSearchHistory = getSearchHistory(limit);
    let videoSearchHistory = getSearchedVideoHistory(limit);

    videoSearchHistory = videoSearchHistory.map((id) => getBasicVideoDetailsById(id));

    return {
        searchedKeys: textSearchHistory,
        searchedVideos: videoSearchHistory,
    };
};

const initSearchService = () => {
    initSearchHistoryService();
    initSearch();
};

module.exports = {
    getSearchResults,
    addToSearchHistoryService,
    deleteSearchHistoryItemService,
    clearSearchHistoryService,
    initSearchService,
    getSearchHistory,
    getSearchHistoryService,
    getIndexedSearchHistory,
};
