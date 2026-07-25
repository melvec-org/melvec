const { getEmbeddingByVideoId } = require('../database/metaDataDbService');
const cosineSimilarityVector = require('../related-videos/cosineSimilarityVector');
const { generateEmbeddingFromKeywords } = require('../service-utils/generateEmbedding');

const getSemanticMatches = async (keywords, candidateVideoIds) => {
    const keywordsEmbeding = await generateEmbeddingFromKeywords(keywords);
    return candidateVideoIds
        .map((videoId) => {
            const embeding = getEmbeddingByVideoId(videoId);
            return {
                videoId: videoId,
                score: embeding.length ? cosineSimilarityVector(keywordsEmbeding, embeding) : 0,
            };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
};

module.exports = {
    getSemanticMatches,
};
