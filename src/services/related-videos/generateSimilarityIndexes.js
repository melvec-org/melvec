const jaccardSimilarity = require('./jaccardSimilarity.js');
const process = require('process');

// Max videos compared per tag/playlist bucket.
// A bucket of 500 yields at most 500*499/2 = ~125K pairs — safe at 100K library size.
// Buckets larger than this (popular/generic tags) are sampled randomly so they
// still contribute signal without causing a combinatorial explosion.
const MAX_BUCKET_SIZE = 500;

/**
 * Returns a random sample of `size` items from an array.
 * Used to cap oversized tag/playlist buckets.
 *
 * @param {Array} arr
 * @param {number} size
 * @returns {Array}
 */
const sampleArray = (arr, size) => {
    if (arr.length <= size) return arr;
    const sampled = [...arr];
    for (let i = sampled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sampled[i], sampled[j]] = [sampled[j], sampled[i]];
    }
    return sampled.slice(0, size);
};

/**
 * Builds a similarity map for video pairs sharing at least one attribute value.
 * Uses an inverted index to avoid comparing unrelated pairs.
 * Uses a videoMap for O(1) video lookup instead of find() inside nested loops.
 * Caps each bucket at MAX_BUCKET_SIZE to prevent hot tags from causing
 * a combinatorial explosion at large library sizes.
 *
 * @param {Array} videos
 * @param {string} attribute - e.g. 'tags' or 'playlists'
 * @returns {Map<string, number>} pair key → jaccard score
 */
const computeAttributeSimilarityMap = (videos, attribute) => {
    const similarityMap = new Map();

    // Build videoMap once for O(1) lookup — avoids find() inside nested loops
    const videoMap = new Map(videos.map((v) => [v.videoId, v]));

    const invertedIndex = new Map();
    videos.forEach((video) => {
        (video[attribute] || []).forEach((item) => {
            if (!invertedIndex.has(item)) invertedIndex.set(item, new Set());
            invertedIndex.get(item).add(video.videoId);
        });
    });

    const processedPairs = new Set();
    for (const [_, videoIds] of invertedIndex) {
        if (videoIds.size <= 1) continue;

        // Cap oversized buckets — popular tags like "nature" or "tutorial"
        // shared by thousands of videos would cause millions of pairs otherwise
        const videoArray = sampleArray([...videoIds], MAX_BUCKET_SIZE);

        for (let i = 0; i < videoArray.length - 1; i++) {
            const videoAId = videoArray[i];
            const videoA = videoMap.get(videoAId);
            for (let j = i + 1; j < videoArray.length; j++) {
                const videoBId = videoArray[j];
                const key = videoAId < videoBId ? `${videoAId}:${videoBId}` : `${videoBId}:${videoAId}`;
                if (!processedPairs.has(key)) {
                    processedPairs.add(key);
                    const videoB = videoMap.get(videoBId);
                    const jSim = jaccardSimilarity(videoA[attribute] || [], videoB[attribute] || []);
                    if (jSim > 0) {
                        similarityMap.set(key, jSim);
                    }
                }
            }
        }
    }

    return similarityMap;
};

/**
 * Builds an adjacency map from the similarityMap so each video
 * can look up its related videos in O(1) instead of scanning all videos.
 *
 * @param {Map<string, number>} similarityMap
 * @returns {Map<string, Array<{videoId: string, score: number}>>}
 */
const buildAdjacencyMap = (similarityMap) => {
    const adjacencyMap = new Map();

    for (const [key, score] of similarityMap) {
        const [a, b] = key.split(':');

        if (!adjacencyMap.has(a)) adjacencyMap.set(a, []);
        if (!adjacencyMap.has(b)) adjacencyMap.set(b, []);

        adjacencyMap.get(a).push({ videoId: b, score });
        adjacencyMap.get(b).push({ videoId: a, score });
    }

    return adjacencyMap;
};

/**
 * Derives related videos for a target video using a pre-built adjacency map.
 * O(k log k) where k = number of related candidates — not O(N).
 *
 * @param {Map} adjacencyMap - videoId → [{videoId, score}]
 * @param {string} targetId
 * @param {number} [limit=50]
 * @returns {Array<{videoId: string, score: number}>}
 */
const deriveRelatedVideos = (adjacencyMap, targetId, limit = 50) => {
    const candidates = adjacencyMap.get(targetId) || [];

    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
};

const generateSimilarityIndexes = (videos, attr) => {
    if ((videos && videos.length <= 0) || !attr) return;

    const similarityMap = computeAttributeSimilarityMap(videos, attr);

    // Build adjacency map once — each video gets direct access to its related list
    const adjacencyMap = buildAdjacencyMap(similarityMap);

    const MAX_RELATED_VIDEOS_LIMIT = 50;

    const relatedVideosMap = {};
    videos.forEach((video) => {
        relatedVideosMap[video.videoId] = deriveRelatedVideos(adjacencyMap, video.videoId, MAX_RELATED_VIDEOS_LIMIT);
    });

    return relatedVideosMap;
};

module.exports = {
    generateSimilarityIndexes,
};
