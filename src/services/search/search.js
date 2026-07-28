const { MAX_SEARCH_RESULTS_CACHE_COUNT, MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY } = require('../../configs/appConfig');
const { getVideoByTitleSearch, getVideosByFileNameSearch: getVideoByFileNameDbSearch } = require('../database/videoLibraryDbService');
const {
    getImagesByFileNameSearch: getImageByFileNameDbSearch,
    getImagesByTitleDbSearch,
    getImagesByFileNameSearch,
} = require('../database/imageLibraryDbService');
const { getAudiosByFileNameSearch, getAudiosByTitleDbSearch } = require('../database/audioLibraryDbService');

const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const mediaTypes = require('../../constants/mediaTypes');
const indexingEvents = require('../../events/indexingEvents');

const { getTags } = require('../tags/tags');
const { getVideoIdsByTag } = require('../tags/tags');
const { getVideosByMetaData } = require('./getVideosByMetaData');
const { rebuildAndSaveTypoCorrectionVocabulary, getSavedTypoCorrectionVocabulary } = require('./prepareTypoCorrectionVocabulary');
const {
    initializeTypoCorrection,
    getCorrectionForToken,
    isTypoCorrectionInitialized,
    invalidateTypoCorrectionIndex,
} = require('./typoCorrection');
const { getImageIdsByTag } = require('../database/tagsDbService');
const { getImagesByMetaData } = require('./getImagesByMetaData');
const { getAudiosByMetaData } = require('./getAudiosByMetaData');

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

const getMediaByTagSearch = (keyword) => {
    const allTags = getTags();
    const tagMatches = allTags.filter((tag) => tag.label.toLowerCase().includes(keyword));
    const tagMatchedVideos = tagMatches.map((item) => getVideoIdsByTag(item.id));
    const tagMatchedImages = tagMatches.map((item) => getImageIdsByTag(item.id));
    const allVideos = tagMatchedVideos.reduce((acc, videos) => acc.concat(videos), []);
    const allImages = tagMatchedImages.reduce((acc, images) => acc.concat(images), []);
    const allAudios = tagMatchedImages.reduce((acc, audios) => acc.concat(audios), []);

    const uniqueVideos = [...new Set(allVideos)].map((id) => ({
        id,
        mediaType: mediaTypes.VIDEO,
    }));

    const uniqueImages = [...new Set(allImages)].map((id) => ({
        id,
        mediaType: mediaTypes.IMAGE,
    }));

    const uniqueAudios = [...new Set(allAudios)].map((id) => ({
        id,
        mediaType: mediaTypes.AUDIO,
    }));

    return [...uniqueVideos, ...uniqueImages, ...uniqueAudios];
};

const normalizeResultsByMediaType = (items, mediaType) => {
    return (items || []).map((item) => ({
        ...item,
        mediaType,
    }));
};

const mediaByTitleSearch = (keyword) => {
    const videoMatches = normalizeResultsByMediaType(getVideoByTitleSearch(keyword), mediaTypes.VIDEO);
    const imageMatches = normalizeResultsByMediaType(getImagesByTitleDbSearch(keyword), mediaTypes.IMAGE);
    const audioMatches = normalizeResultsByMediaType(getAudiosByTitleDbSearch(keyword), mediaTypes.AUDIO);

    return [...videoMatches, ...imageMatches, ...audioMatches];
};

const getMediaByFileNameSearch = (keyword) => {
    const videoMatches = normalizeResultsByMediaType(getVideoByFileNameDbSearch(keyword), mediaTypes.VIDEO);
    const imageMatches = normalizeResultsByMediaType(getImagesByFileNameSearch(keyword), mediaTypes.IMAGE);
    const audioMatches = normalizeResultsByMediaType(getAudiosByFileNameSearch(keyword), mediaTypes.AUDIO);

    return [...videoMatches, ...imageMatches, ...audioMatches];
};

const getMediaByMetaDataSearch = async (searchText, isQuickSearch) => {
    const videoMatches = normalizeResultsByMediaType(await getVideosByMetaData(searchText, isQuickSearch), mediaTypes.VIDEO);
    const imageMatches = normalizeResultsByMediaType(await getImagesByMetaData(searchText, isQuickSearch), mediaTypes.IMAGE);
    const audioMatches = normalizeResultsByMediaType(await getAudiosByMetaData(searchText, isQuickSearch), mediaTypes.AUDIO);

    return [...videoMatches, ...imageMatches, ...audioMatches];
};

const getCorrectedSearchText = (searchText) => {
    const tokens = searchText.toLowerCase().trim().split(/\s+/).filter(Boolean);

    if (!tokens.length) {
        return null;
    }

    const correctedTokens = tokens.map((token) => {
        return getCorrectionForToken(token) || token;
    });

    const correctedKeyword = correctedTokens.join(' ');

    if (correctedKeyword === searchText) {
        return null;
    }

    return correctedKeyword;
};

const ensureTypoCorrectionInitialized = () => {
    if (isTypoCorrectionInitialized()) {
        return;
    }

    const vocabulary = getSavedTypoCorrectionVocabulary();

    if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
        return;
    }

    initializeTypoCorrection(vocabulary);
};

const search = async (searchText = '', isQuickSearch = true, filters = { fileNames: true, tags: true }) => {
    if (searchText === '') return noSearchData;
    searchText = searchText.toLowerCase();

    const cacheKey = `${searchText}_${isQuickSearch}`;

    const cachedResult = searchResultsCache.get(cacheKey);
    if (cachedResult) {
        cachedResult['isCached'] = true;
        return cachedResult;
    }

    const RESULT_LIMIT = isQuickSearch ? 3 : MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY;
    const META_DATA_SEARCH_LIMIT = isQuickSearch ? 5 : MAX_SEARCH_RESULTS_DISPLAY_COUNT_PER_CATEGORY;

    const mediaByTags = getMediaByTagSearch(searchText);

    const mediaByTitles = mediaByTitleSearch(searchText);

    const mediaByFileNames = getMediaByFileNameSearch(searchText);

    // normal perfectly matching search results
    let mediaByMetaData = await getMediaByMetaDataSearch(searchText, isQuickSearch);

    let correctedText = '';
    // if it does not result in anything, check if there are typo errors that can be addressed
    if (mediaByMetaData.length === 0) {
        ensureTypoCorrectionInitialized();

        correctedText = getCorrectedSearchText(searchText);

        if (correctedText) {
            mediaByMetaData = await getMediaByMetaDataSearch(correctedText, isQuickSearch);
        }
    }

    const totalResults = mediaByTags.length + mediaByTitles.length + mediaByFileNames.length + mediaByMetaData.length;

    const finalResults = {
        byTags: mediaByTags.slice(0, RESULT_LIMIT),
        byTitles: mediaByTitles.slice(0, RESULT_LIMIT),
        byFileNames: mediaByFileNames.slice(0, RESULT_LIMIT),
        byMetaData: mediaByMetaData.slice(0, META_DATA_SEARCH_LIMIT),
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
