const { getEmbeddingByVideoId } = require('../database/metaDataDbService');
const cosineSimilarityVector = require('./cosineSimilarityVector');

const deriveRelatedVideosByEmbedding = (videoId, videos, embeddingMap, topN = 24) => {
    const sourceEmbedding = embeddingMap[videoId];

    if (!sourceEmbedding.length) {
        return [];
    }

    return videos
        .filter((video) => video !== videoId)
        .map((videoId) => {
            const candidateEmbedding = embeddingMap[videoId];

            return {
                videoId: videoId,
                score: candidateEmbedding.length ? cosineSimilarityVector(sourceEmbedding, candidateEmbedding) : 0,
            };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
};

/**
 * Builds a related-videos similarity map using embedding vectors.
 *
 * Processes videos in chunks of CHUNK_SIZE to avoid loading all embeddings
 * into memory at once. Each video is compared only against others in the
 * same chunk. Videos without embeddings are skipped.
 *
 * Note that this approach may not be the most efficient for very large datasets, this is ok for 5k-50K, but after that
 * We have to change to ANN index ( Approximate Nearest Neighbors) or similar,
 *
 * TODO make it ANN indexing for better performance later than just cosine similarity.
 * Our approach would be if there are less than 10k videos we will keep it simple,
 * If there are more than 50k videos, we will need to use ANN index. - but this is not for now.
 *
 * @param {string[]} videoIds - All video IDs to process.
 * @returns {Object} Map of videoId → array of related video IDs.
 */
const generateDescVectorSimilarityMap = (videoIds = []) => {
    const MAX_RELATED_VIDEOS_LIMIT = 24;
    const CHUNK_SIZE = 1000;
    const relatedVideosMap = {};

    for (let i = 0; i < videoIds.length; i += CHUNK_SIZE) {
        const chunk = videoIds.slice(i, i + CHUNK_SIZE);
        const embeddingMap = {};

        // Load embeddings only for this chunk — previous chunk is GC'd
        chunk.forEach((videoId) => {
            const embedding = getEmbeddingByVideoId(videoId);
            if (embedding && embedding.length) {
                embeddingMap[videoId] = embedding;
            }
        });

        const chunkIdsWithEmbeddings = Object.keys(embeddingMap);

        chunkIdsWithEmbeddings.forEach((videoId) => {
            relatedVideosMap[videoId] = deriveRelatedVideosByEmbedding(
                videoId,
                chunkIdsWithEmbeddings,
                embeddingMap,
                MAX_RELATED_VIDEOS_LIMIT,
            );
        });
    }

    return relatedVideosMap;
};

module.exports = {
    deriveRelatedVideosByEmbedding,
    generateDescVectorSimilarityMap,
};
