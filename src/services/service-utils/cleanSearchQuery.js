const { STOP_WORDS } = require('../../constants/stopWords');

/**
 * Normalizes a raw search query into searchable terms.
 *
 * The query is lowercased, stripped of punctuation, split on whitespace,
 * and filtered to remove short terms and configured stop words.
 *
 * @param {string} query - Raw user-entered search query.
 * @returns {string[]|null} Cleaned search terms or null when no valid terms remain.
 */
const cleanSearchTerms = (query) => {
    let terms = query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // remove punctuation
        .split(/\s+/)
        .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

    if (terms.length === 0) return null; // or fallback to original

    return terms;
};

/**
 * Escapes and wraps an FTS token in double quotes.
 *
 * @param {*} token - Token value to escape.
 * @returns {string} Token formatted for SQLite FTS queries.
 */
const quoteFtsToken = (token) => {
    const safe = String(token ?? '')
        .replace(/"/g, '""')
        .trim();
    return `"${safe}"`;
};

/**
 * Builds a SQLite FTS NEAR query from cleaned terms.
 *
 * @param {string[]} cleanedTerms - Preprocessed search terms.
 * @param {number} [proximity=10] - Maximum distance allowed between tokens.
 * @returns {string} FTS query string ready for database use.
 */
const buildNearQuery = (cleanedTerms, proximity = 10) => {
    if (!Array.isArray(cleanedTerms) || cleanedTerms.length === 0) {
        return '""';
    }

    const terms = cleanedTerms
        .filter(Boolean)
        .map((t) => String(t).trim())
        .filter(Boolean);
    if (terms.length === 0) return '""';

    // Single word → just match the token
    if (terms.length < 2) {
        return quoteFtsToken(terms[0]);
    }

    const prox = Number.isFinite(proximity) ? Math.max(1, Math.floor(proximity)) : 10;

    // Build: "t1" NEAR/10 "t2" NEAR/10 "t3" ...
    const inside = terms.map(quoteFtsToken).join(' ');

    return `NEAR(${inside}, ${prox})`;
};

module.exports = {
    cleanSearchTerms,
    buildNearQuery,
};
