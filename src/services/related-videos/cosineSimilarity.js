/**
 * Computes cosine similarity between two TF-IDF vectors.
 * @param {Object} tfidfA vector { term: score }.
 * @param {Object} tfidfB vector { term: score }.
 */
const cosineSimilarity = (tfidfA, tfidfB) => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Compute dot product and norm for A
    for (const term in tfidfA) {
        if (tfidfB[term]) {
            dotProduct += tfidfA[term] * tfidfB[term];
        }
        normA += tfidfA[term] ** 2;
    }

    // Compute norm for B
    for (const term in tfidfB) {
        normB += tfidfB[term] ** 2;
    }

    // Compute cosine similarity
    const cosineSimilarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    return cosineSimilarity;
};

module.exports = cosineSimilarity;
