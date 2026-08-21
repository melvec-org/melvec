/**
 * In-memory lookup of subject phrases to their source subject objects.
 *
 * The full-name index is used for exact phrase matches. The token index stores arrays
 * so a single query token like `rahul` can broaden the search to multiple subjects.
 */
const subjectIndexes = {
    exact: new Map(),
    tokens: new Map(),
};
const { STOP_WORDS } = require('../../../constants/stopWords');

/**
 * Splits a raw query into whitespace-delimited tokens and removes empty entries.
 *
 * @param {string} [query=''] Raw user query.
 * @returns {string[]} Ordered query words.
 */
const normalizeWords = (query = '') => query.trim().split(/\s+/).filter(Boolean);

/**
 * Normalizes a phrase for case-insensitive lookups.
 *
 * @param {string} [value=''] Raw phrase.
 * @returns {string} Normalized lookup value.
 */
const normalizeLookupValue = (value = '') =>
    normalizeWords(value)
        .map((word) => word.toLowerCase())
        .join(' ');

const getSubjectsList = () => {
    // TODO - fetch the subjectd data from db - keep it minimal.
    // note that subject list is flattned array. if there are aliases, then it has to be flattened as well.
    /*
    [
 {
   name:"john smith",
   id:"123"
 },
 {
   name:"papa",
   id:"123"
 },
 {
   name:"dad",
   id:"123"
 }
]
 */
    return [];
};

function addSubjectToIndex(index, key, subject) {
    if (!key) return;

    const subjects = index.get(key) || [];

    if (!subjects.includes(subject)) {
        subjects.push(subject);
    }

    index.set(key, subjects);
}

/**
 * Rebuilds the in-memory subject indexes from the provided subject list.
 *
 * TODO: This would go to face-tag service later as we may have to build the cache around it.
 *
 * Subjects without a `name` are ignored. Full names are indexed for exact phrase
 * matching, and each space-delimited token is indexed for broader fallback matching.
 *
 * @param {Array<{id:string,name:string}>} [subjectsList=[]] Available subjects to index.
 * @returns {{ exact: Map<string, Array<{id:string,name:string}>>, tokens: Map<string, Array<{id:string,name:string}>> }} The rebuilt subject lookup indexes.
 */
const getSubjectNames = (subjectsList = null) => {
    if (subjectsList === null) {
        subjectsList = getSubjectsList();
    }

    subjectIndexes.exact.clear();
    subjectIndexes.tokens.clear();

    for (const subject of subjectsList) {
        if (!subject?.name) continue;

        const normalizedName = normalizeLookupValue(subject.name);

        if (!normalizedName) continue;

        addSubjectToIndex(subjectIndexes.exact, normalizedName, subject);

        for (const token of normalizeWords(normalizedName)) {
            addSubjectToIndex(subjectIndexes.tokens, token, subject);
        }
    }

    return subjectIndexes;
};

/**
 * Builds all contiguous phrase combinations from a token list, longest phrases first.
 *
 * Each token keeps its original query index so matched subject words can later be
 * removed from the original query without removing stop words.
 *
 * @param {Array<{word: string, index: number}>} tokens Filtered tokens with original indexes.
 * @returns {Array<{text: string, tokenIndexes: number[], words: string[]}>} Candidate subject phrases.
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
        if (used.has(index)) return true;
    }

    return false;
}

function markUsedWords(phrase, used) {
    for (const index of phrase.tokenIndexes) {
        used.add(index);
    }
}

function resolveSubjectsMatch(phrase, subjectIndexes) {
    const exactSubjects = subjectIndexes.exact.get(phrase.text);

    if (exactSubjects?.length) {
        return exactSubjects.slice(0, 1);
    }

    return subjectIndexes.tokens.get(phrase.text) || [];
}

/**
 * Removes matched subject words from the original query while preserving all other words,
 * including stop words.
 *
 * @param {string} query Original user query.
 * @param {Set<number>} used Original query indexes already consumed by matched subjects.
 * @returns {string} Query text with matched subject words removed.
 */
function getRemainingWords(query, used) {
    const words = normalizeWords(query);
    return words.filter((_, index) => !used.has(index)).join(' ');
}

function getUsedWords(phrases) {
    return phrases.flatMap((phrase) => phrase.words);
}

/**
 * Extracts subjects from a query and returns the unmatched remainder.
 *
 * Matching ignores stop words such as `of` or `in`, but `remainingWords` is always
 * reconstructed from the original query so non-subject stop words are preserved.
 * Subjects are matched case-insensitively against the provided `subjectsList`, and
 * longer phrases are considered before shorter ones. Exact full-name matches win;
 * otherwise a single query token can expand to multiple subjects.
 *
 * @param {string} [query=''] Raw user query.
 * @param {Array<{id:string,name:string}>} [subjectsList=[]] Candidate subjects available for matching.
 * @returns {{ subjects: Array<{id:string,name:string}>, remainingWords: string }} Matched subjects and the remaining query text.
 */
const analyseSubjects = (query = '', subjectsList = null) => {
    const matches = [];
    const matchedSubjectIds = new Set();
    const used = new Set();
    const usedPhrases = [];

    const subjectIndexes = getSubjectNames(subjectsList);

    const filteredTokens = normalizeWords(query)
        .map((word, index) => ({ word, index }))
        .filter(({ word }) => !STOP_WORDS.has(word.toLowerCase()));

    const phrases = generatePhrases(filteredTokens);

    for (const phrase of phrases) {
        if (overlapsUsedWords(phrase, used)) continue;

        const subjects = resolveSubjectsMatch(phrase, subjectIndexes);

        if (!subjects.length) continue;

        for (const subject of subjects) {
            if (!matchedSubjectIds.has(subject.id)) {
                matches.push(subject);
                matchedSubjectIds.add(subject.id);
            }
        }

        markUsedWords(phrase, used);
        usedPhrases.push(phrase);
    }

    usedPhrases.sort((a, b) => a.tokenIndexes[0] - b.tokenIndexes[0]);

    return {
        subjects: matches,
        usedWords: getUsedWords(usedPhrases),
        remainingWords: getRemainingWords(query, used),
    };
};

module.exports = { analyseSubjects, getSubjectNames };
