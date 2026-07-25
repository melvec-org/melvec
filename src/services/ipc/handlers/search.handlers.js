const serviceMethods = require('../../../constants/serviceMethods');
const {
    getSearchResults,
    getSearchHistoryService,
    getIndexedSearchHistory,
    clearSearchHistoryService,
} = require('../../search/search.service');

const { reIndexAllDataService } = require('../../global.service');

const searchServiceHandlers = [
    [serviceMethods.SEARCH_REINDEX_ALL_DATA, async () => reIndexAllDataService()],
    [serviceMethods.SEARCH_GET_INDEXED_HISTORY, async () => getIndexedSearchHistory()],
    [serviceMethods.SEARCH_GET_HISTORY, async (limit) => getSearchHistoryService(limit)],
    [serviceMethods.SEARCH_GET_RESULTS, async (query, isQuickSearch, filters) => getSearchResults(query, isQuickSearch, filters)],
    [serviceMethods.SEARCH_CLEAR_HISTORY, async () => clearSearchHistoryService()],
];

module.exports = {
    searchServiceHandlers,
};
