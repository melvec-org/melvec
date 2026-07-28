const { searchAudiosByDescription, searchAudiosLooseByDescription, getEmbeddingByAudioId } = require('../database/audioLibraryDbService');
const userPreferenceStore = require('../../main/userPreferenceStore');
const { cleanSearchTerms } = require('../service-utils/cleanSearchQuery');
const cosineSimilarityVector = require('../related-videos/cosineSimilarityVector');
const { generateEmbeddingFromKeywords } = require('../service-utils/generateEmbedding');

const dedupeCandidates = (...candidateLists) => {
    const uniqueCandidates = new Map();

    candidateLists.flat().forEach((item) => {
        if (!item || !item.id) return;

        if (!uniqueCandidates.has(item.id)) {
            uniqueCandidates.set(item.id, item);
        }
    });

    return Array.from(uniqueCandidates.values());
};

const rerankWithSemantic = async (keywords, searchCandidates) => {
    if (!searchCandidates.length) return [];

    const keywordsEmbedding = await generateEmbeddingFromKeywords(keywords);
    const reranked = searchCandidates
        .map((item) => {
            const embedding = getEmbeddingByAudioId(item.id);
            return {
                ...item,
                score: embedding.length ? cosineSimilarityVector(keywordsEmbedding, embedding) : 0,
            };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

    return reranked.length ? reranked : searchCandidates;
};

const normalizeMatches = (items) => {
    if (!items || !items.length) return [];

    return items.map((item) => ({
        id: item.id,
        score: item.score,
        descMatch: item.desc_match ?? null,
    }));
};

/**
 * Audio description search strategy
 *
 * AI disabled:
 * - Use strict FTS description search only.
 *
 * AI enabled:
 * - Quick search:
 *   - 1 to 3 meaningful terms: use strict FTS only for speed and precision.
 *   - 4+ meaningful terms: use strict FTS candidates first; if too few results
 *     are found, expand with loose FTS candidates.
 *
 * - Full search:
 *   - 1 meaningful term: use strict FTS only.
 *   - 2+ meaningful terms: use strict FTS candidates first; if too few results
 *     are found, expand with loose FTS candidates.
 */
const getAudiosByMetaData = async (keywords, isQuickSearch = true) => {
    const normalizedKeywords = String(keywords || '').trim();
    const effectiveTerms = cleanSearchTerms(normalizedKeywords) || [];
    const keywordCount = effectiveTerms.length;
    const isAIEnabled = userPreferenceStore.get('isAIEnabled');

    if (keywordCount === 0) return [];

    const strictCandidates = searchAudiosByDescription(normalizedKeywords);

    if (!isAIEnabled) {
        return normalizeMatches(strictCandidates);
    }

    if (isQuickSearch) {
        if (keywordCount <= 3) {
            return normalizeMatches(strictCandidates);
        }

        const MIN_QUICK_SEARCH_CANDIDATES = 5;
        let searchCandidates = strictCandidates;

        if (searchCandidates.length < MIN_QUICK_SEARCH_CANDIDATES) {
            const looseCandidates = searchAudiosLooseByDescription(normalizedKeywords);
            searchCandidates = dedupeCandidates(strictCandidates, looseCandidates);
        }

        const matches = await rerankWithSemantic(normalizedKeywords, searchCandidates);
        return normalizeMatches(matches);
    }

    if (keywordCount === 1) {
        return normalizeMatches(strictCandidates);
    }

    const MIN_FULL_SEARCH_CANDIDATES = 5;
    let searchCandidates = strictCandidates;

    if (searchCandidates.length < MIN_FULL_SEARCH_CANDIDATES) {
        const looseCandidates = searchAudiosLooseByDescription(normalizedKeywords);
        searchCandidates = dedupeCandidates(strictCandidates, looseCandidates);
    }

    const matches = await rerankWithSemantic(normalizedKeywords, searchCandidates);
    return normalizeMatches(matches);
};

module.exports = {
    getAudiosByMetaData,
};
