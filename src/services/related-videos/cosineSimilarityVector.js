const cosineSimilarityVector = (vectorA = [], vectorB = []) => {
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
        throw new Error('cosineSimilarityVector expects two arrays');
    }

    if (vectorA.length === 0 || vectorB.length === 0) {
        return 0;
    }

    if (vectorA.length !== vectorB.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        const a = Number(vectorA[i]) || 0;
        const b = Number(vectorB[i]) || 0;

        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

module.exports = cosineSimilarityVector;
