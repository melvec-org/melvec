/**
 * In-memory typo-correction support for search.
 *
 * This module:
 * - builds a normalized vocabulary from raw searchable terms
 * - creates a trigram index for fast fuzzy candidate lookup
 * - retrieves candidate terms by trigram overlap
 * - selects the best correction using edit-distance similarity
 *
 * It is intentionally stateful and should be initialized whenever the
 * searchable index data changes.
 */
const { STOP_WORDS } = require('../../constants/stopWords');
const { getNormalizedEditScore } = require('../service-utils/stringSimilarity');

const minCandidateOverlapCount = 2;
const minCorrectionScore = 0.65;

/**
 * Default configuration for typo-correction vocabulary building and lookup.
 *
 * These limits help avoid indexing noisy tokens and control fuzzy matching behavior.
 *
 * @type {{
 *   minVocabularyTokenLength: number,
 *   maxTokenLength: number,
 *   minTokenLength: number
 * }}
 */
const defaultOptions = {
    minTokenLength: 5,
    minVocabularyTokenLength: 4,
    maxTokenLength: 50,
};

/**
 * Creates a fresh internal state object for the typo-correction engine.
 *
 * @returns {{
 *   isInitialized: boolean,
 *   options: object,
 *   terms: string[],
 *   termSet: Set<string>,
 *   trigramIndex: Map<string, number[]>,
 *   correctionCache: Map<string, *>
 * }}
 */
const createEmptyState = () => ({
    isInitialized: false,
    options: { ...defaultOptions },
    terms: [],
    termSet: new Set(),
    trigramIndex: new Map(),
    correctionCache: new Map(),
});

let state = createEmptyState();

/**
 * Normalizes a term for tokenization and trigram indexing.
 *
 * Behavior:
 * - lowercase
 * - trim
 * - replace punctuation / underscores with spaces
 * - collapse repeated whitespace
 *
 * @param {string} term
 * @returns {string}
 */
const normalizeTerm = (term) => {
    return String(term || '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]|_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Tokenizes raw text into normalized vocabulary terms.
 *
 * Filtering behavior:
 * - removes empty tokens
 * - removes tokens shorter than `minVocabularyTokenLength`
 * - removes tokens longer than `maxTokenLength`
 * - removes stop words
 * - removes numeric-only tokens
 * - removes duplicates while preserving first occurrence order
 *
 * @param {string} text
 * @param {{
 *   minVocabularyTokenLength: number,
 *   maxTokenLength: number
 * }} [options=state.options]
 * @returns {string[]}
 */
const tokenizeText = (text, options = state.options) => {
    const seen = new Set();

    return normalizeTerm(text)
        .split(/\s+/)
        .filter((token) => {
            if (!token) return false;
            if (token.length < options.minVocabularyTokenLength) return false; // checks if the word/s are less then min vocabulary lenth say 3
            if (token.length > options.maxTokenLength) return false;
            if (STOP_WORDS.has(token)) return false;
            if (/^\d+$/.test(token)) return false;
            if (seen.has(token)) return false;

            seen.add(token);
            return true;
        });
};

/**
 * Prepares a unique normalized vocabulary list from raw terms.
 *
 * Filtering behavior:
 * - removes non-string values
 * - removes empty normalized terms
 * - removes terms shorter than `minVocabularyTokenLength`
 * - removes terms longer than `maxTokenLength`
 * - removes stop words
 * - removes numeric-only terms
 * - removes duplicates while preserving first occurrence order
 *
 * @param {string[]} [terms=[]]
 * @param {{
 *   minVocabularyTokenLength: number,
 *   maxTokenLength: number
 * }} [options=defaultOptions]
 * @returns {string[]}
 */
const prepareVocabularyTerms = (terms = [], options = defaultOptions) => {
    const uniqueTerms = new Set();

    terms.forEach((term) => {
        if (typeof term !== 'string') {
            return;
        }

        const normalizedTerm = normalizeTerm(term);

        if (!normalizedTerm) return;
        if (normalizedTerm.length < options.minVocabularyTokenLength) return;
        if (normalizedTerm.length > options.maxTokenLength) return;
        if (STOP_WORDS.has(normalizedTerm)) return;
        if (/^\d+$/.test(normalizedTerm)) return;

        uniqueTerms.add(normalizedTerm);
    });

    return [...uniqueTerms];
};
/**
 * Builds a unique trigram list for a normalized term.
 *
 * The term is padded with spaces before trigram extraction so prefix/suffix
 * differences are represented in the generated grams.
 *
 * @param {string} term
 * @returns {string[]}
 */
const getTrigrams = (term) => {
    const normalized = normalizeTerm(term);

    if (!normalized) {
        return [];
    }

    const padded = `  ${normalized}  `;
    const grams = new Set();

    for (let i = 0; i < padded.length - 2; i++) {
        grams.add(padded.slice(i, i + 3));
    }

    return [...grams];
};

/**
 * Builds a trigram index mapping each trigram to the term ids that contain it.
 *
 * Returned postings contain term indexes from the provided `terms` array.
 *
 * @param {string[]} terms
 * @returns {Map<string, number[]>}
 */
const buildTrigramIndex = (terms) => {
    const trigramIndex = new Map();

    terms.forEach((term, termId) => {
        const grams = getTrigrams(term);

        grams.forEach((gram) => {
            if (!trigramIndex.has(gram)) {
                trigramIndex.set(gram, []);
            }

            trigramIndex.get(gram).push(termId);
        });
    });

    return trigramIndex;
};

/**
 * Returns candidate term ids from the trigram index for a given token.
 *
 * Candidates are ranked by trigram overlap strength and may be filtered by a
 * minimum overlap threshold.
 *
 * @param {string} token
 * @returns {number[]}
 */
const getCandidateTermIds = (token) => {
    if (!state.isInitialized) {
        return [];
    }

    const normalizedToken = normalizeTerm(token);

    if (!normalizedToken) {
        return [];
    }

    const grams = getTrigrams(normalizedToken);
    const candidateCounts = new Map();

    grams.forEach((gram) => {
        const postings = state.trigramIndex.get(gram) || [];

        postings.forEach((termId) => {
            candidateCounts.set(termId, (candidateCounts.get(termId) || 0) + 1);
        });
    });

    return [...candidateCounts.entries()]
        .filter(([, overlapCount]) => overlapCount >= minCandidateOverlapCount)
        .sort((a, b) => b[1] - a[1])
        .map(([termId]) => termId);
};

/**
 * Returns the best correction for a token if a sufficiently similar indexed
 * vocabulary term exists.
 *
 * Behavior:
 * - returns `null` if the engine is not initialized
 * - returns `null` for empty or too-short tokens
 * - returns the original normalized token if already present in the vocabulary
 * - otherwise ranks trigram candidates using edit-distance similarity
 *
 * @param {string} token
 * @returns {string|null}
 */
const getCorrectionForToken = (token) => {
    if (!state.isInitialized) {
        return null;
    }

    const normalizedToken = normalizeTerm(token);

    if (!normalizedToken) {
        return null;
    }

    if (normalizedToken.length < state.options.minTokenLength) {
        return null;
    }

    if (state.termSet.has(normalizedToken)) {
        return normalizedToken;
    }

    const candidateTermIds = getCandidateTermIds(normalizedToken);

    if (!candidateTermIds.length) {
        return null;
    }

    let bestMatch = null;

    candidateTermIds.forEach((termId) => {
        const candidate = state.terms[termId];

        if (!candidate) {
            return;
        }

        const score = getNormalizedEditScore(normalizedToken, candidate);

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
                term: candidate,
                score,
            };
        }
    });

    if (!bestMatch) {
        return null;
    }

    if (bestMatch.score < minCorrectionScore) {
        return null;
    }

    return bestMatch.term;
};

/**
 * Initializes the typo-correction engine from a prepared vocabulary term list.
 *
 * Input terms are expected to already represent vocabulary items, such as the
 * output of `prepareTypoCorrectionVocabulary` or
 * `prepareTypoCorrectionVocabularyFromDb`.
 *
 * Terms are normalized and defensively filtered before the trigram index is built.
 *
 * @param {string[]} [terms=[]]
 * @param {object} [options={}]
 * @returns {{
 *   totalTerms: number,
 *   totalTrigrams: number
 * }}
 */
const initializeTypoCorrection = (terms = [], options = {}) => {
    const mergedOptions = {
        ...defaultOptions,
        ...options,
    };

    const preparedTerms = prepareVocabularyTerms(terms, mergedOptions);

    state = {
        isInitialized: true,
        options: mergedOptions,
        terms: preparedTerms,
        termSet: new Set(preparedTerms),
        trigramIndex: buildTrigramIndex(preparedTerms),
        correctionCache: new Map(),
    };

    return {
        totalTerms: preparedTerms.length,
        totalTrigrams: state.trigramIndex.size,
    };
};

/**
 * Resets the typo-correction engine to its uninitialized state.
 *
 * @returns {void}
 */
const invalidateTypoCorrectionIndex = () => {
    state = createEmptyState();
};

/**
 * Indicates whether the typo-correction engine has been initialized.
 *
 * @returns {boolean}
 */
const isTypoCorrectionInitialized = () => {
    return state.isInitialized;
};

module.exports = {
    normalizeTerm,
    tokenizeText,
    prepareVocabularyTerms,
    getTrigrams,
    buildTrigramIndex,
    initializeTypoCorrection,
    invalidateTypoCorrectionIndex,
    isTypoCorrectionInitialized,
    getCandidateTermIds,
    getCorrectionForToken,
};
