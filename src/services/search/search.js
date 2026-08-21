const { MAX_SEARCH_RESULTS_CACHE_COUNT, MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY } = require('../../configs/appConfig');

const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');

const indexingEvents = require('../../events/indexingEvents');

const { rebuildAndSaveTypoCorrectionVocabulary } = require('./prepareTypoCorrectionVocabulary');
const { invalidateTypoCorrectionIndex } = require('./typoCorrection');

const { analyseQuery } = require('./search-planner/searchPlanner');

const { getMediaByFileNameSearch, mediaByTitleSearch, getMediaByTagSearch } = require('./helpers/getMediaBySearchCriteria');
const { getMediaByContent } = require('./helpers/getMediaByContent');

const noSearchData = {
    byTags: [],
    byTitles: [],
    byFileNames: [],
    byMetaData: [],
    totalCount: 0,
    searchText: '',
    correctedText: '',
};

const searchResultsCache = new LRUCache(MAX_SEARCH_RESULTS_CACHE_COUNT);

/**
 * Filtering constraints like time, mediatype, content type, max per set results will trim down the results.
 * @param {*} results
 * @param {*} constraints
 * @returns
 */

const search = async (searchText = '', isQuickSearch = true, filters = { fileNames: true, tags: true }) => {
    if (searchText === '') return noSearchData;
    searchText = searchText.toLowerCase();

    // Step - 0 : If result is already cached, then return it.
    const cacheKey = `${searchText}_${isQuickSearch}`;

    const cachedResult = searchResultsCache.get(cacheKey);
    if (cachedResult) {
        cachedResult['isCached'] = true;
        return cachedResult;
    }

    // set the limits
    const RESULT_LIMIT = isQuickSearch ? 3 : MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY;
    const META_DATA_SEARCH_LIMIT = isQuickSearch ? 5 : MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY;

    // Step - 01 : Analyse the search query and find contextual results
    const searchPlan = analyseQuery(searchText);

    // Step 02 : Find out media by individual search criterias
    // tags
    const mediaByTags = getMediaByTagSearch(searchText);

    // titles
    const mediaByTitles = mediaByTitleSearch(searchText);

    // fileNames
    const mediaByFileNames = getMediaByFileNameSearch(searchText);

    // content
    const resultSet = await getMediaByContent(searchPlan, isQuickSearch);

    const mediaByContent = resultSet.results;
    const correctedText = resultSet.correctedText;

    const totalResults = mediaByTags.length + mediaByTitles.length + mediaByFileNames.length + mediaByContent.length;

    const finalResults = {
        byTags: mediaByTags.slice(0, RESULT_LIMIT),
        byTitles: mediaByTitles.slice(0, RESULT_LIMIT),
        byFileNames: mediaByFileNames.slice(0, RESULT_LIMIT),
        byContent: mediaByContent.slice(0, META_DATA_SEARCH_LIMIT),
        totalCount: totalResults,
        searchText: searchText,
        correctedText: totalResults > 0 && correctedText ? correctedText : '',
    };

    searchResultsCache.set(cacheKey, finalResults);

    return finalResults;
};

const onDataIntegrityChange = async (data) => {
    searchResultsCache.clear();

    const validChangeEvents = [
        indexingEvents.VIDEO_TITLE_CHANGE,
        indexingEvents.VIDEO_META_DATA_CHANGE,
        indexingEvents.IMAGE_TITLE_CHANGE,
        indexingEvents.IMAGE_META_DATA_CHANGE,
    ];

    if (validChangeEvents.includes(data.change)) {
        await rebuildAndSaveTypoCorrectionVocabulary();
        invalidateTypoCorrectionIndex();
    }
};

const initSearch = (config) => {
    searchResultsCache.clear();
    serviceEventBus.subscribe(interServiceEvents.INDEX_DATA_CHANGED, async (data) => {
        await onDataIntegrityChange(data);
    });
};

module.exports = {
    initSearch,
    search,
};
