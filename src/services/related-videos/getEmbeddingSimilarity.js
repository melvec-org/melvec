const { getEmbeddingByVideoId } = require('../database/metaDataDbService');
const cosineSimilarityVector = require('./cosineSimilarityVector');

const getEmbeddingSimilarity = (sourceVideoId, candidateVideoId) => {
    const sourceEmbedding = getEmbeddingByVideoId(sourceVideoId) || [];
    const candidateEmbedding = getEmbeddingByVideoId(candidateVideoId) || [];

    if (!sourceEmbedding.length || !candidateEmbedding.length) {
        return 0;
    }

    return cosineSimilarityVector(sourceEmbedding, candidateEmbedding);
};

module.exports = {
    getEmbeddingSimilarity,
};
