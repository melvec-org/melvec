const {
    preprocessTitle,
    computeTFIDF,
    deriveRelatedVideos,
    generateTitleSimilarityIndexes,
} = require('./generateTitleSimilarityIndexes');
const cosineSimilarity = require('./cosineSimilarity');

// ─── preprocessTitle ────────────────────────────────────────────────────────

test('should correctly preprocess titles by removing stop words, punctuation, converting to lowercase, and splitting into words', () => {
    const title = 'The Adventure of Sherlock Holmes: A Mystery in London!';
    const expectedOutput = ['adventure', 'sherlock', 'holmes', 'mystery', 'london'];
    const processedTitle = preprocessTitle(title);
    expect(processedTitle).toEqual(expectedOutput);

    // Additional test case for edge cases
    const edgeCaseTitle = '!!!The quick brown fox jumps over the lazy dog!!!';
    const edgeCaseExpectedOutput = ['quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog'];
    const processedEdgeCaseTitle = preprocessTitle(edgeCaseTitle);
    expect(processedEdgeCaseTitle).toEqual(edgeCaseExpectedOutput);

    // New test case: title with numbers and special characters
    const numericTitle = '123 The 456 Adventure 789!';
    const numericExpectedOutput = ['123', '456', 'adventure', '789'];
    const processedNumericTitle = preprocessTitle(numericTitle);
    expect(processedNumericTitle).toEqual(numericExpectedOutput);

    // New test case: title with mixed casing and extra spaces
    const mixedCaseTitle = '  The   MIXED    Case   Example ';
    const mixedCaseExpectedOutput = ['mixed', 'case', 'example'];
    const processedMixedCaseTitle = preprocessTitle(mixedCaseTitle);
    expect(processedMixedCaseTitle).toEqual(mixedCaseExpectedOutput);
});

// ─── deriveRelatedVideos ─────────────────────────────────────────────────────

describe('deriveRelatedVideos', () => {
    const videos = [
        { videoId: 'v1', title: 'Nature documentary wildlife' },
        { videoId: 'v2', title: 'Nature wildlife forest' },
        { videoId: 'v3', title: 'Space exploration documentary' },
        { videoId: 'v4', title: 'Cooking recipes kitchen' },
    ];

    let tfidfData;
    let termToVideoIds;
    let vectorMap;

    beforeEach(() => {
        tfidfData = computeTFIDF(videos);

        termToVideoIds = new Map();
        tfidfData.vectors.forEach(({ videoId, tfidf }) => {
            Object.keys(tfidf).forEach((term) => {
                if (!termToVideoIds.has(term)) termToVideoIds.set(term, new Set());
                termToVideoIds.get(term).add(videoId);
            });
        });

        vectorMap = new Map(tfidfData.vectors.map((v) => [v.videoId, v]));
    });

    test('should return related videos ranked by title similarity', () => {
        const results = deriveRelatedVideos('v1', tfidfData, termToVideoIds, vectorMap);
        const resultIds = results.map((r) => r.videoId);

        // v2 shares 'nature' and 'wildlife' with v1 — should rank highest
        expect(resultIds[0]).toBe('v2');
        // v4 shares no terms with v1 — should not appear
        expect(resultIds).not.toContain('v4');
    });

    test('should not include the target video in results', () => {
        const results = deriveRelatedVideos('v1', tfidfData, termToVideoIds, vectorMap);
        expect(results.map((r) => r.videoId)).not.toContain('v1');
    });

    test('should return empty array for unknown videoId', () => {
        const results = deriveRelatedVideos('unknown', tfidfData, termToVideoIds, vectorMap);
        expect(results).toEqual([]);
    });

    test('should respect topN limit', () => {
        const results = deriveRelatedVideos('v1', tfidfData, termToVideoIds, vectorMap, 1);
        expect(results.length).toBeLessThanOrEqual(1);
    });

    test('should fall back to full scan when no termToVideoIds provided', () => {
        // Without index — still returns results, just via full scan
        const results = deriveRelatedVideos('v1', tfidfData, null, null);
        expect(Array.isArray(results)).toBe(true);
    });

    test('all results should have a score greater than 0', () => {
        const results = deriveRelatedVideos('v1', tfidfData, termToVideoIds, vectorMap);
        results.forEach((r) => expect(r.score).toBeGreaterThan(0));
    });
});

// ─── generateTitleSimilarityIndexes ─────────────────────────────────────────

describe('generateTitleSimilarityIndexes', () => {
    const videos = [
        { videoId: 'v1', title: 'Nature documentary wildlife' },
        { videoId: 'v2', title: 'Nature wildlife forest' },
        { videoId: 'v3', title: 'Space exploration documentary' },
        { videoId: 'v4', title: 'Cooking recipes kitchen' },
        { videoId: 'v5', title: '' }, // should be skipped
    ];

    test('should return a map with an entry for every video with a title', () => {
        const result = generateTitleSimilarityIndexes(videos);
        expect(result['v1']).toBeDefined();
        expect(result['v2']).toBeDefined();
        expect(result['v3']).toBeDefined();
        expect(result['v4']).toBeDefined();
    });

    test('should rank videos sharing more title terms higher', () => {
        const result = generateTitleSimilarityIndexes(videos);
        // v1 shares 'nature' + 'wildlife' with v2, only 'documentary' with v3
        expect(result['v1'][0].videoId).toBe('v2');
    });

    test('should not include the video itself in its own related list', () => {
        const result = generateTitleSimilarityIndexes(videos);
        Object.entries(result).forEach(([videoId, related]) => {
            expect(related.map((r) => r.videoId)).not.toContain(videoId);
        });
    });

    test('should return empty related list for video with no shared terms', () => {
        const result = generateTitleSimilarityIndexes(videos);
        // v4 shares no terms with any other video
        expect(result['v4']).toEqual([]);
    });

    test('should handle a single video without crashing', () => {
        const result = generateTitleSimilarityIndexes([{ videoId: 'v1', title: 'Solo video title' }]);
        expect(result['v1']).toEqual([]);
    });

    test('should handle empty input without crashing', () => {
        const result = generateTitleSimilarityIndexes([]);
        expect(result).toEqual({});
    });
});
