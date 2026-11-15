const { getBasicVideoDetailsById } = require('../video-library/videoLibrary.service');
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
const { respondFailure, respondSuccess, respondError } = require('../service-utils/sendToUI');
const { populateMediaDetails } = require('./helpers/populateMediaDetails');

const getSearchResultsService = async (searchString, isQuickSearch, filters) => {
    try {
        const searchResults = await search(searchString, isQuickSearch, filters);

        if (!searchResults.isCached) {
            if (searchResults.byTags.length > 0) {
                searchResults.byTags = populateMediaDetails(searchResults.byTags);
            }
            if (searchResults.byTitles.length > 0) {
                searchResults.byTitles = populateMediaDetails(searchResults.byTitles);
            }
            if (searchResults.byFileNames.length > 0) {
                searchResults.byFileNames = populateMediaDetails(searchResults.byFileNames);
            }
            if (searchResults.byContent.length > 0) {
                searchResults.byContent = populateMediaDetails(searchResults.byContent);
            }
        }
        return respondSuccess('Successful Search', searchResults);
    } catch (e) {
        return respondError('Failed to search', e);
    }
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
    getSearchResultsService,
    addToSearchHistoryService,
    deleteSearchHistoryItemService,
    clearSearchHistoryService,
    initSearchService,
    getSearchHistory,
    getSearchHistoryService,
    getIndexedSearchHistory,
};
