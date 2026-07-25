const { tokenizeText } = require('./typoCorrection');
const { getAllVideoIds, getVideoDetailsById, getVideoTitlesAndDescriptionsByIds } = require('../database/videoLibraryDbService');
const { getMetaDataById } = require('../database/metaDataDbService');
const { getTags } = require('../database/tagsDbService');
const { getPlaylists } = require('../database/playlistsDbService');
const { saveVocabulary, getVocabulary } = require('../database/vocabularyDbServices');
const { getAllImageIds, getFullImageDetailsById } = require('../image-library/imageLibrary');
const { getImageDetailsById, getImageDescriptionById, getImageTitlesAndDescriptionsByIds } = require('../database/imageLibraryDbService');

const VOCABULARY_BATCH_SIZE = 200;

let cachedVocabulary = null;

/**
 * Adds normalized tokens from the provided texts into an existing vocabulary set.
 *
 * @param {Set<string>} vocabulary
 * @param {string[]} [texts=[]]
 * @param {object} [options={}]
 * @returns {Set<string>}
 */
const addTextsToVocabulary = (vocabulary, texts = [], options = {}) => {
    texts.forEach((text) => {
        if (typeof text !== 'string') {
            return;
        }

        tokenizeText(text, options).forEach((token) => {
            vocabulary.add(token);
        });
    });

    return vocabulary;
};

/**
 * Builds a unique typo-correction vocabulary from a list of raw text values.
 *
 * This is intended as a preprocessing step before initializing the typo
 * correction engine. It extracts normalized searchable tokens from large text
 * fields such as titles and descriptions and deduplicates them globally.
 *
 * @param {string[]} [texts=[]]
 * @param {object} [options={}]
 * @returns {string[]}
 */
const prepareTypoCorrectionVocabulary = (texts = [], options = {}) => {
    const vocabulary = new Set();

    addTextsToVocabulary(vocabulary, texts, options);

    return [...vocabulary];
};

/**
 * Extracts searchable raw text values for a single video from video title and
 * metadata description.
 *
 * @param {string} videoId
 * @returns {string[]}
 */
const extractSearchableTextsFromVideo = (videoId) => {
    const texts = [];

    if (!videoId) {
        return texts;
    }

    const videoDetails = getVideoDetailsById(videoId);

    if (videoDetails && typeof videoDetails === 'object') {
        if (typeof videoDetails.title === 'string' && videoDetails.title.trim()) {
            texts.push(videoDetails.title);
        }
    }

    const metadata = getMetaDataById(videoId);

    if (metadata && typeof metadata === 'object') {
        if (typeof metadata.description === 'string' && metadata.description.trim()) {
            texts.push(metadata.description);
        }
    }

    return texts;
};

/**
 * Extracts searchable raw text values for a single image from its title and
 * description (stored directly on the image record, unlike videos which use
 * a separate metadata table).
 *
 * @param {string} imageId
 * @returns {string[]}
 */
const extractSearchableTextsFromImage = (imageId) => {
    const texts = [];

    if (!imageId) {
        return texts;
    }

    const imageDetails = getImageDetailsById(imageId);
    const imageDescription = getImageDescriptionById(imageId);

    if (imageDetails && typeof imageDetails === 'object') {
        if (typeof imageDetails.title === 'string' && imageDetails.title.trim()) {
            texts.push(imageDetails.title);
        }

        if (typeof imageDescription === 'string' && imageDescription.trim()) {
            texts.push(imageDescription);
        }
    }

    return texts;
};

/**
 * Builds a unique typo-correction vocabulary from current DB-backed search data.
 *
 * This method processes records incrementally to avoid building a large
 * intermediate text array in memory.
 *
 * Sources used:
 * - video title
 * - metadata description
 * - tag labels
 * - playlist labels
 *
 * @param {object} [options={}]
 * @returns {string[]}
 */
const prepareTypoCorrectionVocabularyFromDb = (options = null) => {
    const videoIds = getAllVideoIds() || [];
    const vocabulary = new Set();

    if (!options) {
        options = {
            minTokenLength: 5,
            minVocabularyTokenLength: 3,
            maxTokenLength: 50,
        };
    }

    // Process videos in small batches — 1 query per batch instead of 2 per video
    for (let i = 0; i < videoIds.length; i += VOCABULARY_BATCH_SIZE) {
        const batch = videoIds.slice(i, i + VOCABULARY_BATCH_SIZE);
        const rows = getVideoTitlesAndDescriptionsByIds(batch);
        rows.forEach((row) => {
            const texts = [];
            if (typeof row.title === 'string' && row.title.trim()) texts.push(row.title);
            if (typeof row.description === 'string' && row.description.trim()) texts.push(row.description);
            addTextsToVocabulary(vocabulary, texts, options);
        });
    }

    // Process images in small batches
    const imageIds = getAllImageIds() || [];
    for (let i = 0; i < imageIds.length; i += VOCABULARY_BATCH_SIZE) {
        const batch = imageIds.slice(i, i + VOCABULARY_BATCH_SIZE);
        const rows = getImageTitlesAndDescriptionsByIds(batch);
        rows.forEach((row) => {
            const texts = [];
            if (typeof row.title === 'string' && row.title.trim()) texts.push(row.title);
            if (typeof row.description === 'string' && row.description.trim()) texts.push(row.description);
            addTextsToVocabulary(vocabulary, texts, options);
        });
    }

    const tags = getTags() || [];
    const tagLabels = tags.filter((tag) => tag && typeof tag.label === 'string' && tag.label.trim()).map((tag) => tag.label);

    if (tagLabels.length > 0) {
        addTextsToVocabulary(vocabulary, tagLabels, options);
    }

    const playlists = getPlaylists() || [];
    const playlistLabels = playlists
        .filter((playlist) => playlist && typeof playlist.label === 'string' && playlist.label.trim())
        .map((playlist) => playlist.label);

    if (playlistLabels.length > 0) {
        addTextsToVocabulary(vocabulary, playlistLabels, options);
    }

    return [...vocabulary];
};

/**
 *
 * Intended future behavior:
 * - persist normalized vocabulary terms to a dedicated table
 * - support incremental rebuilds or full refreshes
 *
 * @param {string[]} vocabulary
 * @returns {Promise<void>}
 */

const rebuildAndSaveTypoCorrectionVocabulary = async (options = null) => {
    const vocabulary = prepareTypoCorrectionVocabularyFromDb(options);
    const savedVocabulary = saveVocabulary(vocabulary);

    cachedVocabulary = null;

    return savedVocabulary;
};

const getSavedTypoCorrectionVocabulary = () => {
    if (cachedVocabulary) {
        return cachedVocabulary;
    }

    const vocabulary = getVocabulary() || [];

    if (vocabulary.length > 0) {
        cachedVocabulary = vocabulary;
    }

    return vocabulary;
};

const clearPreparedTypoCorrectionVocabularyCache = () => {
    cachedVocabulary = null;
};

module.exports = {
    addTextsToVocabulary,
    prepareTypoCorrectionVocabulary,
    extractSearchableTextsFromVideo,
    extractSearchableTextsFromImage,
    prepareTypoCorrectionVocabularyFromDb,
    getSavedTypoCorrectionVocabulary,
    clearPreparedTypoCorrectionVocabularyCache,
    rebuildAndSaveTypoCorrectionVocabulary,
};
