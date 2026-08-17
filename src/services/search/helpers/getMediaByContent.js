const { getMediaByLocations } = require('./getMediaByLocation');
const { getMediaBySubjects } = require('./getMediaBySubjects');

const { getMediaByMetaDataSearch } = require('./getMediaBySearchCriteria');

const { initializeTypoCorrection, getCorrectionForToken, isTypoCorrectionInitialized } = require('../typoCorrection');
const { getSavedTypoCorrectionVocabulary } = require('../prepareTypoCorrectionVocabulary');
const { populateMediaDetails } = require('./populateMediaDetails');

/**
 * Returns a typo-corrected version of the search text when any token can be corrected.
 *
 * @param {string} searchText
 * @returns {string | null}
 */
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

/**
 * Lazily initializes typo correction vocabulary if it has not already been initialized.
 *
 * @returns {void}
 */
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

/**
 * Intersects multiple media arrays by media id.
 * Empty arrays participate in the intersection and can reduce the result to an empty list.
 *
 * @param {...Array<{ id: string | number }>} arrays
 * @returns {Array}
 */
const intersectMedia = (...arrays) => {
    const validArrays = arrays.filter(Array.isArray);

    if (validArrays.length === 0) return [];
    if (validArrays.length === 1) return validArrays[0];

    // Start with the smallest array for better performance
    validArrays.sort((a, b) => a.length - b.length);

    let result = validArrays[0];

    for (let i = 1; i < validArrays.length; i++) {
        const ids = new Set(validArrays[i].map((item) => item.id));

        result = result.filter((item) => ids.has(item.id));

        if (result.length === 0) {
            break;
        }
    }

    return result;
};

/**
 * Builds the candidate media set from contextual constraints such as locations and subjects,
 * then applies media type filtering if requested.
 *
 * @param {{
 *   locations: Array,
 *   subjects: Array,
 *   mediaTypes: Array<string>
 * }} constraints
 * @returns {Array}
 */
const buildCandidateMediaSet = (constraints) => {
    // Kill this search if there are no constraints available.
    if (constraints.locations.length === 0 && constraints.subjects.length === 0) return [];

    let candidateSets = [];
    // locations
    if (constraints.locations.length > 0) {
        candidateSets.push(getMediaByLocations(constraints.locations));
    }

    // subjects
    if (constraints.subjects.length > 0) {
        candidateSets.push(getMediaBySubjects(constraints.subjects));
    }

    let candidateMedia = intersectMedia(...candidateSets);

    if (constraints.mediaTypes.length > 0) {
        candidateMedia = candidateMedia.filter((item) => constraints.mediaTypes.includes(item.mediaType));
    }

    return candidateMedia;
};

/**
 * Filters media by a time range using populated media details.
 *
 * @param {Array} list
 * @param {{ from: number, to: number }} timeConstraint
 * @returns {Array}
 */
const filterByTime = (list, timeConstraint) => {
    return list.filter((item) => item.birthtimeMs > timeConstraint.from && item.birthtimeMs < timeConstraint.to) || [];
};

const filterByContentTypes = (list, contentTypes) => {
    return list.filter((item) => contentTypes.includes(item.categoryId)) || [];
};

/**
 * Applies supported constraints to the result set.
 *
 * @param {Array} results
 * @param {{ time: { from: number, to: number } | null }} constraints
 * @returns {Array}
 */
function applyConstraints(results, constraints) {
    if (results.length === 0) return [];

    let resultDetailsList = results;

    if (constraints.time !== null || constraints.contentTypes.length > 0) {
        resultDetailsList = populateMediaDetails(resultDetailsList);
    }

    if (constraints.time !== null) {
        resultDetailsList = filterByTime(resultDetailsList, constraints.time);
    }

    if (constraints.contentTypes.length > 0) {
        resultDetailsList = filterByContentTypes(resultDetailsList, constraints.contentTypes);
    }

    return resultDetailsList.map((item) => {
        return {
            id: item.id,
            mediaType: item.mediaType,
        };
    });
}

/**
 * Searches media by combining contextual candidate media with metadata matches,
 * applying typo correction fallback and post-search constraints.
 *
 * @param {{
 *   constraints: {
 *     locations: Array,
 *     subjects: Array,
 *     mediaTypes: Array<string>,
 *     time: { from: number, to: number } | null
 *   },
 *   remainingWords: string
 * }} searchPlan
 * @param {boolean} isQuickSearch
 * @returns {Promise<{ results: Array, correctedText: string }>}
 */
const getMediaByContent = async (searchPlan, isQuickSearch) => {
    const mediaTypeFilter = searchPlan.constraints.mediaTypes.length > 0 ? searchPlan.constraints.mediaTypes : null;

    // First Step figure out if we have any regular candiate mediaset is there.
    const candidateContextMediaIds = buildCandidateMediaSet(searchPlan.constraints);

    // Step 02: normal perfectly matching search results
    let mediaByMetaData = await getMediaByMetaDataSearch(searchPlan.remainingWords, isQuickSearch, mediaTypeFilter);

    let correctedText = '';
    // if it does not result in anything, check if there are typo errors that can be addressed
    if (mediaByMetaData.length === 0) {
        ensureTypoCorrectionInitialized();

        correctedText = getCorrectedSearchText(searchPlan.remainingWords);

        if (correctedText) {
            mediaByMetaData = await getMediaByMetaDataSearch(correctedText, isQuickSearch, mediaTypeFilter);
        }
    }

    let commonMedia = [];

    // Intersect only when both context and metadata have matches.
    // Otherwise, use whichever result set has data.
    if (candidateContextMediaIds.length > 0 && mediaByMetaData.length > 0) {
        commonMedia = intersectMedia(candidateContextMediaIds, mediaByMetaData);
    } else if (candidateContextMediaIds.length > 0) {
        commonMedia = candidateContextMediaIds;
    } else {
        commonMedia = mediaByMetaData;
    }

    commonMedia = applyConstraints(commonMedia, searchPlan.constraints);

    return {
        results: commonMedia,
        correctedText: correctedText,
    };
};

module.exports = {
    getMediaByContent,
};
