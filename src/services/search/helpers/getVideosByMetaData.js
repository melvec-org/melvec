const { searchFromMetaData, searchLooseFromMetaData } = require('../../database/metaDataDbService');
const { getSemanticMatches } = require('../getSemanticMatches');
const { cleanSearchTerms } = require('../../service-utils/cleanSearchQuery');
const { isAIActive } = require('../../service-utils/ai');

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

const normalizeMatches = (items) => {
    if (!items || !items.length) return [];

    return items.map((item) => ({
        id: item.id ?? item.videoId,
        score: item.score,
    }));
};

const rerankWithSemantic = async (keywords, searchCandidates) => {
    if (!searchCandidates.length) return [];

    const candidateVideoIds = searchCandidates.map((item) => item.id);
    const semanticMatches = await getSemanticMatches(keywords, candidateVideoIds);

    if (!semanticMatches.length) {
        return searchCandidates;
    }

    return semanticMatches;
};

/**
 * Metadata search strategy
 *
 * AI disabled:
 * - Use strict FTS metadata search only.
 *
 * AI enabled:
 * - Quick search:
 *   - 1 to 3 meaningful terms: use strict FTS only for speed and precision.
 *   - 4+ meaningful terms: use strict FTS candidates first; if too few results are found,
 *     expand with loose FTS candidates, then semantic-rerank the candidate set.
 *
 * - Full search:
 *   - 1 meaningful term: use strict FTS only.
 *   - 2+ meaningful terms: use strict FTS candidates first; if too few results are found,
 *     expand with loose FTS candidates, then semantic-rerank the candidate set.
 *
 * In all semantic flows:
 * - fallback to lexical candidates if semantic ranking returns no matches.
 */
const getVideosByMetaData = async (keywords, isQuickSearch = true) => {
    const normalizedKeywords = String(keywords || '').trim();
    const effectiveTerms = cleanSearchTerms(normalizedKeywords) || [];
    const keywordCount = effectiveTerms.length;

    if (keywordCount === 0) return [];

    const strictCandidates = searchFromMetaData(normalizedKeywords);

    if (!isAIActive()) {
        return normalizeMatches(strictCandidates);
    }

    if (isQuickSearch) {
        if (keywordCount <= 3) {
            return normalizeMatches(strictCandidates);
        }

        const MIN_QUICK_SEARCH_CANDIDATES = 5;
        let searchCandidates = strictCandidates;

        if (searchCandidates.length < MIN_QUICK_SEARCH_CANDIDATES) {
            const looseCandidates = searchLooseFromMetaData(normalizedKeywords);
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
        const looseCandidates = searchLooseFromMetaData(normalizedKeywords);
        searchCandidates = dedupeCandidates(strictCandidates, looseCandidates);
    }
    const matches = await rerankWithSemantic(normalizedKeywords, searchCandidates);
    return normalizeMatches(matches);
};

module.exports = {
    getVideosByMetaData,
};
