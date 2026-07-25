const serviceMethods = require('../../constants/serviceMethods');
const searchApi = (ipcRenderer) => ({
    getSearchResults: (searchText, isQuickSearch, filters) =>
        ipcRenderer.invoke(serviceMethods.SEARCH_GET_RESULTS, searchText, isQuickSearch, filters),
    getSearchHistory: (limit) => ipcRenderer.invoke(serviceMethods.SEARCH_GET_HISTORY, limit),
    getIndexedSearchHistory: () => ipcRenderer.invoke(serviceMethods.SEARCH_GET_INDEXED_HISTORY),
    clearSearchHistory: () => ipcRenderer.invoke(serviceMethods.SEARCH_CLEAR_HISTORY),
    reIndexAllData: () => ipcRenderer.invoke(serviceMethods.SEARCH_REINDEX_ALL_DATA),
});
module.exports = { searchApi };
