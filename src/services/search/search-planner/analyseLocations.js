/**
 * In-memory lookup of location phrases to their source location objects.
 *
 * exact:
 *   "jaipur rajasthan" -> [location]
 *
 * tokens:
 *   "jaipur" -> [location]
 *   "rajasthan" -> [location]
 *
 * Aliases should be flattened into the location list before indexing.
 */
const locationIndexes = {
    exact: new Map(),
    tokens: new Map(),
};

const { getAllLocationNames } = require('../../location/location');
const { STOP_WORDS } = require('../../../constants/stopWords');

/**
 * Splits a raw query into whitespace-delimited tokens.
 *
 * @param {string} [query=''] Raw user query.
 * @returns {string[]} Ordered query words.
 */
const normalizeWords = (query = '') =>
    query
        .trim()
        .split(/\s|\,\s+/)
        .filter(Boolean);

/**
 * Normalizes a phrase for case-insensitive lookups.
 *
 * @param {string} [value=''] Raw phrase.
 * @returns {string} Normalized phrase.
 */
const normalizeLookupValue = (value = '') =>
    normalizeWords(value)
        .map((word) => word.toLowerCase())
        .join(' ');

/**
 * Adds a location into an index.
 *
 * Multiple locations can have the same name.
 *
 * @param {Map} index Lookup index.
 * @param {string} key Lookup key.
 * @param {Object} location Location object.
 */
function addLocationToIndex(index, key, location) {
    if (!key) return;

    const locations = index.get(key) || [];

    if (!locations.includes(location)) {
        locations.push(location);
    }

    index.set(key, locations);
}

/**
 * Builds the in-memory location indexes.
 *
 * Expected input:
 *
 * [
 *   {
 *      id: "loc_1",
 *      name: "Jaipur Rajasthan",
 *   },
 *   {
 *      id: "loc_1",
 *      name: "Pink City"
 *   }
 * ]
 *
 * Aliases should be flattened before passing here.
 *
 * @param {Array<{id:string,name:string}>} locationsList
 */
const getLocationNames = (locationsList = []) => {
    if (locationsList === null) {
        locationsList = getAllLocationNames();
    }

    locationIndexes.exact.clear();
    locationIndexes.tokens.clear();

    for (const location of locationsList) {
        if (!location?.name) continue;

        const normalizedName = normalizeLookupValue(location.name);

        if (!normalizedName) continue;

        // Full phrase match
        addLocationToIndex(locationIndexes.exact, normalizedName, location);

        // Individual word match
        for (const token of normalizeWords(normalizedName)) {
            addLocationToIndex(locationIndexes.tokens, token, location);
        }
    }

    return locationIndexes;
};

/**
 * Generates possible phrases from query tokens.
 *
 * Longest phrases are checked first.
 */
function generatePhrases(tokens) {
    const result = [];

    for (let length = tokens.length; length > 0; length--) {
        for (let start = 0; start <= tokens.length - length; start++) {
            const slice = tokens.slice(start, start + length);

            result.push({
                text: slice.map(({ word }) => word.toLowerCase()).join(' '),
                tokenIndexes: slice.map(({ index }) => index),
                words: slice.map(({ word }) => word),
            });
        }
    }

    return result;
}

function overlapsUsedWords(phrase, used) {
    for (const index of phrase.tokenIndexes) {
        if (used.has(index)) {
            return true;
        }
    }

    return false;
}

function markUsedWords(phrase, used) {
    for (const index of phrase.tokenIndexes) {
        used.add(index);
    }
}

/**
 * Exact match first, token match second.
 */
function resolveLocationMatch(phrase, indexes) {
    const exactLocations = indexes.exact.get(phrase.text);

    if (exactLocations?.length) {
        return exactLocations;
    }

    return indexes.tokens.get(phrase.text) || [];
}

/**
 * Removes matched location words from query.
 */
function getRemainingWords(query, used) {
    const words = normalizeWords(query);

    return words.filter((_, index) => !used.has(index)).join(' ');
}

function getUsedWords(phrases) {
    return phrases.flatMap((phrase) => phrase.words);
}

/**
 * Extracts locations from a query.
 *
 * Example:
 *
 * Query:
 * "videos from Jaipur Rajasthan 2025"
 *
 * Result:
 *
 * {
 *    locations:[
 *       {
 *          id:"loc_1",
 *          name:"Jaipur Rajasthan"
 *       }
 *    ],
 *    remainingWords:"videos 2025"
 * }
 */
const analyseLocations = (query = '', locationsList = null) => {
    const matches = [];
    const matchedLocationIds = new Set();
    const used = new Set();
    const usedPhrases = [];

    const indexes = getLocationNames(locationsList);

    const filteredTokens = normalizeWords(query)
        .map((word, index) => ({
            word,
            index,
        }))
        .filter(({ word }) => !STOP_WORDS.has(word.toLowerCase()));

    const phrases = generatePhrases(filteredTokens);

    for (const phrase of phrases) {
        if (overlapsUsedWords(phrase, used)) {
            continue;
        }

        const locations = resolveLocationMatch(phrase, indexes);

        if (!locations.length) {
            continue;
        }

        for (const location of locations) {
            if (!matchedLocationIds.has(location.id)) {
                matches.push(location);

                matchedLocationIds.add(location.id);
            }
        }

        markUsedWords(phrase, used);
        usedPhrases.push(phrase);
    }

    usedPhrases.sort((a, b) => a.tokenIndexes[0] - b.tokenIndexes[0]);

    return {
        locations: matches,
        usedWords: getUsedWords(usedPhrases),
        remainingWords: getRemainingWords(query, used),
    };
};

module.exports = {
    analyseLocations,
    getLocationNames,
};
