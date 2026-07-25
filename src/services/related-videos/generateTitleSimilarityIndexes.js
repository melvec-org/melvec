const cosineSimilarity = require('./cosineSimilarity');

/**
 * Preprocesses a title: lowercase, remove punctuation, remove stop words, split into words.
 * @param {string} title - Video title.
 * @returns {string[]} - Array of processed terms.
 */
const preprocessTitle = (title) => {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'of', 'to', 'for', 'with', 'are']);
    const terms = title
        .toLowerCase()
        .replace(/[^\w\s]|_/g, '') // Remove punctuation and underscores
        .split(/\s+/)
        .filter((word) => word && !stopWords.has(word));
    return terms;
};

/**
 * Computes TF-IDF vectors for a list of video titles.
 * @param {Array<{ videoId: string, title: string }>} videos - List of video objects with IDs and titles.
 * @returns {void} - Stores results in tfidfData.
 */
const computeTFIDF = (videos) => {
    // reset tfidfData
    let tfidfData = {
        vectors: [],
        vocabulary: new Set(),
        idf: {},
        videoTitles: {},
    };

    const termCounts = {}; // Count of each term in each video
    const docFreq = {}; // Number of documents each term appears in

    videos.forEach(({ videoId, title }) => {
        tfidfData.videoTitles[videoId] = title;

        // Preprocess: lowercase, remove punctuation, split into words, remove stop words
        const terms = preprocessTitle(title);

        termCounts[videoId] = {};
        const seenTerms = new Set(); // Track terms in this document to avoid double-counting in docFreq

        terms.forEach((term) => {
            // Update term frequency
            termCounts[videoId][term] = (termCounts[videoId][term] || 0) + 1;

            // Update vocabulary
            tfidfData.vocabulary.add(term);

            if (!seenTerms.has(term)) {
                docFreq[term] = (docFreq[term] || 0) + 1;
                seenTerms.add(term);
            }
        });
    });

    // Compute IDF for each term
    const N = videos.length;
    tfidfData.vocabulary.forEach((term) => {
        tfidfData.idf[term] = Math.log(N / (docFreq[term] || 1)); // Avoid division by zero
    });

    // Compute TF-IDF vectors
    videos.forEach(({ videoId }) => {
        const tfidf = {};
        const terms = Object.keys(termCounts[videoId]);
        const totalTerms = Object.values(termCounts[videoId]).reduce((sum, count) => sum + count, 0);

        terms.forEach((term) => {
            // TF = (term count in document) / (total terms in document)
            const tf = termCounts[videoId][term] / totalTerms;
            // TF-IDF = TF * IDF
            tfidf[term] = tf * tfidfData.idf[term];
        });

        tfidfData.vectors.push({ videoId, tfidf });
    });

    return tfidfData;
};

/**
 * Finds relevant videos for a given videoId based on TF-IDF title similarity.
 * Uses a pre-built inverted index (termToVideoIds) to skip pairs that share
 * no title terms, avoiding an O(N²) full scan.
 * Also uses a pre-built vectorMap for O(1) vector lookup instead of find().
 *
 * @param {string} videoId - Target video ID.
 * @param {Object} precomputedTfidfData - Precomputed TF-IDF data from computeTFIDF.
 * @param {Map<string, Set<string>>} termToVideoIds - Inverted index: term → Set of videoIds.
 * @param {Map<string, Object>} vectorMap - Map of videoId → tfidf vector for O(1) lookup.
 * @param {number} [topN=24] - Max number of related videos to return.
 * @returns {Array<{videoId: string, score: number}>}
 */
const deriveRelatedVideos = (videoId, precomputedTfidfData = null, termToVideoIds = null, vectorMap = null, topN = 24) => {
    const tfidfData = precomputedTfidfData;

    if (!tfidfData.videoTitles[videoId]) return [];

    const targetVector = vectorMap ? vectorMap.get(videoId) : tfidfData.vectors.find((v) => v.videoId === videoId);
    if (!targetVector) return [];

    // Use inverted index to get only candidates sharing at least one title term
    // Falls back to full scan if no index provided (e.g. direct test calls)
    const candidates = new Set();
    if (termToVideoIds) {
        Object.keys(targetVector.tfidf).forEach((term) => {
            const sharing = termToVideoIds.get(term);
            if (sharing) sharing.forEach((id) => { if (id !== videoId) candidates.add(id); });
        });
    } else {
        tfidfData.vectors.forEach((v) => { if (v.videoId !== videoId) candidates.add(v.videoId); });
    }

    return [...candidates]
        .map((candidateId) => {
            const candidateVector = vectorMap ? vectorMap.get(candidateId) : tfidfData.vectors.find((v) => v.videoId === candidateId);
            if (!candidateVector) return null;
            return {
                videoId: candidateId,
                score: cosineSimilarity(targetVector.tfidf, candidateVector.tfidf),
            };
        })
        .filter((item) => item && item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
};

const generateTitleSimilarityIndexes = (videos) => {
    const tfidfDataCache = computeTFIDF(videos.filter((item) => item.title !== ''));
    const MAX_RELATED_VIDEOS_LIMIT = 24;

    // Build inverted index once: term → Set of videoIds containing that term
    const termToVideoIds = new Map();
    tfidfDataCache.vectors.forEach(({ videoId, tfidf }) => {
        Object.keys(tfidf).forEach((term) => {
            if (!termToVideoIds.has(term)) termToVideoIds.set(term, new Set());
            termToVideoIds.get(term).add(videoId);
        });
    });

    // Build vectorMap once for O(1) lookup inside deriveRelatedVideos
    const vectorMap = new Map(tfidfDataCache.vectors.map((v) => [v.videoId, v]));

    let relatedVideosMap = {};
    tfidfDataCache.vectors.forEach(({ videoId }) => {
        relatedVideosMap[videoId] = deriveRelatedVideos(videoId, tfidfDataCache, termToVideoIds, vectorMap, MAX_RELATED_VIDEOS_LIMIT);
    });

    return relatedVideosMap;
};

module.exports = {
    computeTFIDF,
    preprocessTitle,
    deriveRelatedVideos,
    generateTitleSimilarityIndexes,
};
