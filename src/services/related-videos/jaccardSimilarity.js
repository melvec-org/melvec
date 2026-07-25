/**
 * Computes Jaccard similarity for tags or playlists.
 * @param {string[]} setA - Tags or playlists of video A.
 * @param {string[]} setB - Tags or playlists of video B.
 * @returns {number} - Jaccard similarity.
 */
const jaccardSimilarity = (setA, setB) => {
    const a = new Set(setA);
    const b = new Set(setB);
    const intersection = [...a].filter((x) => b.has(x)).length;
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
};

module.exports = jaccardSimilarity;
