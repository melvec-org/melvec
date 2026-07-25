const cosineSimilarity = require('./cosineSimilarity');
const { STOP_WORDS } = require('../../constants/stopWords');
const { getVideoDescriptionsChunk } = require('../database/metaDataDbService');

/**
 * Preprocesses a description: lowercase, remove punctuation, remove stop words, split into words.
 * Limits token count to keep memory and candidate generation under control for large libraries.
 * @param {string} description
 * @param {Object} [options]
 * @param {number} [options.maxUniqueTokens=100]
 * @returns {string[]}
 */
const preprocessDescription = (description, options = {}) => {
    const maxUniqueTokens = options.maxUniqueTokens ?? 100;

    const rawTerms = (description || '')
        .toLowerCase()
        .replace(/[^\w\s]|_/g, ' ')
        .split(/\s+/)
        .filter((word) => word && !STOP_WORDS.has(word));

    if (rawTerms.length === 0) return [];

    const uniqueTerms = [];
    const seen = new Set();

    for (const term of rawTerms) {
        if (seen.has(term)) continue;
        seen.add(term);
        uniqueTerms.push(term);

        if (uniqueTerms.length >= maxUniqueTokens) {
            break;
        }
    }

    return uniqueTerms;
};

/**
 * Computes TF-IDF vectors for a list of video descriptions.
 * Kept for compatibility / smaller datasets.
 * @param {Array<{ videoId: string, description: string }>} videos
 * @returns {Object}
 */
const computeDescriptionTFIDF = (videos) => {
    let tfidfData = {
        vectors: [],
        vocabulary: new Set(),
        idf: {},
        videoDescriptions: {},
    };

    const termCounts = {};
    const docFreq = {};

    videos.forEach(({ videoId, description }) => {
        tfidfData.videoDescriptions[videoId] = description;

        const terms = preprocessDescription(description, { maxUniqueTokens: 100 });

        termCounts[videoId] = {};
        const seenTerms = new Set();

        terms.forEach((term) => {
            termCounts[videoId][term] = (termCounts[videoId][term] || 0) + 1;
            tfidfData.vocabulary.add(term);

            if (!seenTerms.has(term)) {
                docFreq[term] = (docFreq[term] || 0) + 1;
                seenTerms.add(term);
            }
        });
    });

    const N = videos.length;
    tfidfData.vocabulary.forEach((term) => {
        tfidfData.idf[term] = Math.log(N / (docFreq[term] || 1));
    });

    videos.forEach(({ videoId }) => {
        const tfidf = {};
        const terms = Object.keys(termCounts[videoId] || {});
        const totalTerms = Object.values(termCounts[videoId] || {}).reduce((sum, count) => sum + count, 0);

        if (totalTerms > 0) {
            terms.forEach((term) => {
                const tf = termCounts[videoId][term] / totalTerms;
                tfidf[term] = tf * tfidfData.idf[term];
            });
        }

        tfidfData.vectors.push({ videoId, tfidf });
    });

    return tfidfData;
};

/**
 * Finds relevant videos for a given videoId based on description TF-IDF similarity.
 * @param {string} videoId
 * @param {Object} precomputedTfidfData
 * @param {number} topN
 * @returns {Array<{videoId: string, score: number}>}
 */
const deriveRelatedVideosByDescription = (videoId, precomputedTfidfData, topN = 24) => {
    const tfidfData = precomputedTfidfData;

    if (!tfidfData?.videoDescriptions?.[videoId]) return [];

    const targetVector = tfidfData.vectors.find((v) => v.videoId === videoId);
    if (!targetVector) return [];

    return tfidfData.vectors
        .filter((v) => v.videoId !== videoId)
        .map((v) => ({
            videoId: v.videoId,
            score: cosineSimilarity(targetVector.tfidf, v.tfidf),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
};

/**
 * Build inverted index term -> Set(videoId)
 */
const buildInvertedIndex = (videoTokensMap, maxPostingsPerTerm = 5000) => {
    const index = new Map();

    for (const [videoId, tokensSet] of videoTokensMap.entries()) {
        for (const term of tokensSet) {
            let postings = index.get(term);

            if (!postings) {
                postings = new Set();
                index.set(term, postings);
            }

            if (postings.size < maxPostingsPerTerm) {
                postings.add(videoId);
            }
        }
    }

    return index;
};

/**
 * Returns a top-N list from a Map(candidateId -> score)
 */
const takeTopNFromScoreMap = (scoreMap, topN) => {
    const entries = Array.from(scoreMap.entries());

    if (entries.length === 0) return [];

    return entries
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
        .slice(0, topN)
        .map(([videoId, score]) => ({ videoId, score }));
};

const scoreCandidatesForVideo = (videoId, tokensSet, videoTokensMap, invertedIndex, topN, maxCandidatePostingsPerTerm = 0) => {
    if (!tokensSet || tokensSet.size === 0) return [];

    const candidateOverlapMap = new Map();
    const sourceSize = tokensSet.size;
    const allTerms = Array.from(tokensSet);

    let candidateTerms = allTerms.filter((term) => {
        const postingsSize = invertedIndex.get(term)?.size || 0;
        return maxCandidatePostingsPerTerm <= 0 || postingsSize <= maxCandidatePostingsPerTerm;
    });

    if (candidateTerms.length === 0) {
        candidateTerms = allTerms;
    }

    for (const term of candidateTerms) {
        const postings = invertedIndex.get(term);
        if (!postings) continue;

        for (const candidateId of postings) {
            if (candidateId === videoId) continue;
            candidateOverlapMap.set(candidateId, (candidateOverlapMap.get(candidateId) || 0) + 1);
        }
    }

    const candidateScoreMap = new Map();

    for (const candidateId of candidateOverlapMap.keys()) {
        const candidateTokensSet = videoTokensMap.get(candidateId);

        if (!candidateTokensSet || candidateTokensSet.size === 0) continue;

        let intersectionCount = 0;
        for (const term of tokensSet) {
            if (candidateTokensSet.has(term)) {
                intersectionCount++;
            }
        }

        const unionCount = sourceSize + candidateTokensSet.size - intersectionCount;
        const score = unionCount > 0 ? intersectionCount / unionCount : 0;

        if (score > 0) {
            candidateScoreMap.set(candidateId, score);
        }
    }

    return takeTopNFromScoreMap(candidateScoreMap, topN);
};

/**
 * Candidate-first description similarity (in-memory; expects full videos list).
 */
const generateDescriptionSimilarityIndexes = (videos, options = {}) => {
    const topN = options.topN ?? 50;
    const maxUniqueTokens = options.maxUniqueTokens ?? 100;
    const maxPostingsPerTerm = options.maxPostingsPerTerm ?? 5000;
    const maxCandidatePostingsPerTerm = options.maxCandidatePostingsPerTerm ?? 0;

    const videoTokensMap = new Map();

    for (const v of videos) {
        const desc = v.description || '';
        const tokens = desc ? preprocessDescription(desc, { maxUniqueTokens }) : [];
        videoTokensMap.set(v.videoId, new Set(tokens));
    }

    const invertedIndex = buildInvertedIndex(videoTokensMap, maxPostingsPerTerm);

    const relatedVideosMap = {};
    for (const v of videos) {
        relatedVideosMap[v.videoId] = scoreCandidatesForVideo(
            v.videoId,
            videoTokensMap.get(v.videoId),
            videoTokensMap,
            invertedIndex,
            topN,
            maxCandidatePostingsPerTerm,
        );
    }

    return relatedVideosMap;
};

/**
 * Async DB-backed generation for large libraries.
 * @param {string[]} videoIds
 * @param {Object} [options]
 * @param {number} [options.topN=24]
 * @param {number} [options.chunkSize=100]
 * @param {number} [options.maxPostingsPerTerm=5000]
 * @param {number} [options.maxUniqueTokens=100]
 * @param {number} [options.maxCandidatePostingsPerTerm=0]
 * @param {(progress: {phase: string, processed: number, total: number}) => void} [options.onProgress]
 */
const generateDescriptionSimilarityIndexesFromDbAsync = async (videoIds, options = {}) => {
    if (!Array.isArray(videoIds)) {
        throw new Error('generateDescriptionSimilarityIndexesFromDbAsync: videoIds must be an array');
    }

    const totalVideoCount = videoIds.length;

    const topN = options.topN ?? 24;
    const chunkSize = options.chunkSize ?? 100;
    const maxPostingsPerTerm = options.maxPostingsPerTerm ?? 2000;
    const maxUniqueTokens = options.maxUniqueTokens ?? 48;
    const maxCandidatePostingsPerTerm = options.maxCandidatePostingsPerTerm ?? 0;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    const videoTokensMap = new Map();

    for (let i = 0; i < videoIds.length; i += chunkSize) {
        const idsChunk = videoIds.slice(i, i + chunkSize);
        const rows = (await getVideoDescriptionsChunk(idsChunk)) || [];

        for (const row of rows) {
            const tokens = row.description ? preprocessDescription(row.description, { maxUniqueTokens }) : [];

            videoTokensMap.set(row.videoId, new Set(tokens));
        }

        for (const id of idsChunk) {
            if (!videoTokensMap.has(id)) {
                videoTokensMap.set(id, new Set());
            }
        }

        if (onProgress) {
            onProgress({
                phase: 'tokenizing',
                processed: Math.min(i + idsChunk.length, totalVideoCount),
                total: totalVideoCount,
            });
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const invertedIndex = buildInvertedIndex(videoTokensMap, maxPostingsPerTerm);

    if (onProgress) {
        onProgress({
            phase: 'indexing',
            processed: totalVideoCount,
            total: totalVideoCount,
        });
    }

    const relatedVideosMap = {};
    for (let i = 0; i < videoIds.length; i += chunkSize) {
        const idsChunk = videoIds.slice(i, i + chunkSize);

        for (const videoId of idsChunk) {
            relatedVideosMap[videoId] = scoreCandidatesForVideo(
                videoId,
                videoTokensMap.get(videoId),
                videoTokensMap,
                invertedIndex,
                topN,
                maxCandidatePostingsPerTerm,
            );
        }

        if (onProgress) {
            onProgress({
                phase: 'scoring',
                processed: Math.min(i + idsChunk.length, totalVideoCount),
                total: totalVideoCount,
            });
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return relatedVideosMap;
};

/**
 * note that this is a fallback mechanism when there is no AI enabled in the system.
 * This would work with TFIDF methods, and the description may be quite long.
 * This may not result in the best matching similarity index. It works by keyword matching. And a lengthier description will bring more weight to longer des
 * */
module.exports = {
    computeDescriptionTFIDF,
    preprocessDescription,
    deriveRelatedVideosByDescription,
    buildInvertedIndex,
    generateDescriptionSimilarityIndexes,
    generateDescriptionSimilarityIndexesFromDbAsync,
};
