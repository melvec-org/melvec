/**
 * Generic string normalization and similarity utilities used by service modules.
 *
 * These helpers are intended for matching/scoring logic and should not be used
 * for UI display formatting.
 */

/**
 * Normalizes a value for string comparison by:
 * - coercing to string
 * - lowercasing
 * - trimming
 * - replacing punctuation / underscores with spaces
 * - collapsing repeated whitespace
 *
 * This is intended for fuzzy matching and similarity scoring, not for display.
 *
 * @param {*} value
 * @returns {string}
 */
const normalizeForComparison = (value) => {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]|_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Computes Damerau-Levenshtein edit distance between two strings.
 *
 * Supported edit operations:
 * - insertion
 * - deletion
 * - substitution
 * - adjacent transposition
 *
 * Inputs are normalized before distance calculation.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const damerauLevenshtein = (a, b) => {
    const left = normalizeForComparison(a);
    const right = normalizeForComparison(b);

    const rows = left.length + 1;
    const cols = right.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let i = 0; i < rows; i++) {
        matrix[i][0] = i;
    }

    for (let j = 0; j < cols; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;

            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);

            if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
                matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
            }
        }
    }

    return matrix[left.length][right.length];
};

/**
 * Returns a normalized similarity score from 0 to 1 based on edit distance.
 *
 * - `1` means exact match after normalization
 * - values closer to `0` indicate weaker similarity
 *
 * @param {string} input
 * @param {string} candidate
 * @returns {number}
 */
const getNormalizedEditScore = (input, candidate) => {
    const normalizedInput = normalizeForComparison(input);
    const normalizedCandidate = normalizeForComparison(candidate);
    const maxLength = Math.max(normalizedInput.length, normalizedCandidate.length);

    if (maxLength === 0) {
        return 1;
    }

    const distance = damerauLevenshtein(normalizedInput, normalizedCandidate);

    return 1 - distance / maxLength;
};

module.exports = {
    normalizeForComparison,
    damerauLevenshtein,
    getNormalizedEditScore,
};
