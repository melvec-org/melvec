/**
 * In-memory lookup of content type phrases.
 *
 * Example:
 *
 * "movie"          -> "movies"
 * "movies"         -> "movies"
 * "music videos"   -> "music_videos"
 */
const contentTypeIndex = new Map([
    ['home family', 'home_family'],

    ['movie', 'movies'],
    ['movies', 'movies'],

    ['shows', 'shows_series'],
    ['series', 'shows_series'],

    ['documentary', 'documentaries'],
    ['documentaries', 'documentaries'],

    ['music video', 'music_videos'],
    ['music videos', 'music_videos'],

    ['podcast', 'podcasts'],
    ['podcasts', 'podcasts'],

    ['educational', 'educational'],
    ['tutorial', 'educational'],
    ['tutorials', 'educational'],
    ['lecture', 'educational'],
    ['lectures', 'educational'],

    ['short', 'shorts'],
    ['shorts', 'shorts'],
    ['clip', 'shorts'],
    ['clips', 'shorts'],

    ['travel vlog', 'travel_vlogs'],
    ['travel vlogs', 'travel_vlogs'],
    ['travel video', 'travel_vlogs'],
    ['travel videos', 'travel_vlogs'],
    ['vlog', 'travel_vlogs'],
    ['vlogs', 'travel_vlogs'],

    ['sport', 'sports_games'],
    ['sports', 'sports_games'],
    ['game', 'sports_games'],
    ['games', 'sports_games'],

    ['presentation', 'work'],
    ['work', 'work'],

    ['surveillance', 'surveillance'],
    ['surveillance footage', 'surveillance'],
]);

const normalizeWords = (query = '') => query.trim().split(/\s+/).filter(Boolean);

function normalizeLookupValue(value = '') {
    return value.toLowerCase().trim();
}

/**
 * Builds phrase candidates.
 *
 * Longer phrases are checked first.
 */
function generatePhrases(words) {
    const result = [];

    const maxLength = 3;

    for (let length = Math.min(maxLength, words.length); length > 0; length--) {
        for (let start = 0; start <= words.length - length; start++) {
            const slice = words.slice(start, start + length);

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
    return phrase.tokenIndexes.some((index) => used.has(index));
}

function markUsedWords(phrase, used) {
    phrase.tokenIndexes.forEach((index) => used.add(index));
}

function getRemainingWords(query, used) {
    return normalizeWords(query)
        .filter((_, index) => !used.has(index))
        .join(' ');
}

function getUsedWords(phrases) {
    return phrases.flatMap((phrase) => phrase.words);
}

/**
 * Extracts content type constraints from query.
 *
 * Example:
 *
 * "show me documentary about northpole"
 *
 * returns:
 *
 * {
 *    contentTypes:["documentaries"],
 *    remainingWords:"show me about northpole"
 * }
 */
const analyseContentType = (query = '') => {
    const used = new Set();
    const matchedContentTypes = [];
    const usedPhrases = [];

    const tokens = normalizeWords(query).map((word, index) => ({
        word,
        index,
    }));

    const phrases = generatePhrases(tokens);

    for (const phrase of phrases) {
        const contentType = contentTypeIndex.get(normalizeLookupValue(phrase.text));

        if (!contentType) {
            continue;
        }

        if (overlapsUsedWords(phrase, used)) {
            continue;
        }

        matchedContentTypes.push({
            contentType,
            firstTokenIndex: Math.min(...phrase.tokenIndexes),
        });
        usedPhrases.push(phrase);

        markUsedWords(phrase, used);
    }

    matchedContentTypes.sort((a, b) => a.firstTokenIndex - b.firstTokenIndex);
    usedPhrases.sort((a, b) => a.tokenIndexes[0] - b.tokenIndexes[0]);

    const contentTypes = [];
    const seen = new Set();

    for (const { contentType } of matchedContentTypes) {
        if (seen.has(contentType)) {
            continue;
        }

        seen.add(contentType);
        contentTypes.push(contentType);
    }

    return {
        contentTypes,
        usedWords: getUsedWords(usedPhrases),
        remainingWords: getRemainingWords(query, used),
    };
};

module.exports = {
    analyseContentType,
};
