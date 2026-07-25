jest.mock('../database/metaDataDbService', () => ({
    getEmbeddingByVideoId: jest.fn(),
}));

const { getEmbeddingByVideoId } = require('../database/metaDataDbService');
const {
    deriveRelatedVideosByEmbedding,
    generateDescVectorSimilarityMap,
} = require('./deriveRelatedVideosByEmbedding');

describe('deriveRelatedVideosByEmbedding', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns empty array when source embedding is missing', () => {
        const embeddingMap = {
            video1: [],
            video2: [1, 0],
            video3: [0, 1],
        };

        const result = deriveRelatedVideosByEmbedding('video1', ['video1', 'video2', 'video3'], embeddingMap, 24);

        expect(result).toEqual([]);
    });

    test('returns related videos sorted by descending similarity', () => {
        const embeddingMap = {
            video1: [1, 0],
            video2: [1, 0],
            video3: [0.5, 0.5],
            video4: [0, 1],
        };

        const result = deriveRelatedVideosByEmbedding('video1', ['video1', 'video2', 'video3', 'video4'], embeddingMap, 24);

        expect(result).toEqual([
            { videoId: 'video2', score: 1 },
            { videoId: 'video3', score: expect.closeTo(0.7071067812, 10) },
        ]);
    });

    test('excludes the source video from results', () => {
        const embeddingMap = {
            video1: [1, 0],
            video2: [1, 0],
        };

        const result = deriveRelatedVideosByEmbedding('video1', ['video1', 'video2'], embeddingMap, 24);

        expect(result.find((item) => item.videoId === 'video1')).toBeUndefined();
        expect(result).toEqual([{ videoId: 'video2', score: 1 }]);
    });

    test('filters out candidates with empty embeddings', () => {
        const embeddingMap = {
            video1: [1, 0],
            video2: [],
            video3: [1, 0],
        };

        const result = deriveRelatedVideosByEmbedding('video1', ['video1', 'video2', 'video3'], embeddingMap, 24);

        expect(result).toEqual([{ videoId: 'video3', score: 1 }]);
    });

    test('filters out zero-similarity matches', () => {
        const embeddingMap = {
            video1: [1, 0],
            video2: [0, 1],
            video3: [1, 0],
        };

        const result = deriveRelatedVideosByEmbedding('video1', ['video1', 'video2', 'video3'], embeddingMap, 24);

        expect(result).toEqual([{ videoId: 'video3', score: 1 }]);
    });

    test('respects the topN limit', () => {
        const embeddingMap = {
            video1: [1, 0],
            video2: [1, 0],
            video3: [0.9, 0.1],
            video4: [0.8, 0.2],
        };

        const result = deriveRelatedVideosByEmbedding('video1', ['video1', 'video2', 'video3', 'video4'], embeddingMap, 2);

        expect(result).toHaveLength(2);
        expect(result[0].videoId).toBe('video2');
        expect(result[1].videoId).toBe('video3');
    });
});

describe('generateDescVectorSimilarityMap', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('builds similarity map for all provided video ids', () => {
        getEmbeddingByVideoId.mockImplementation((videoId) => {
            const embeddings = {
                video1: [1, 0],
                video2: [1, 0],
                video3: [0, 1],
            };

            return embeddings[videoId] || [];
        });

        const result = generateDescVectorSimilarityMap(['video1', 'video2', 'video3']);

        expect(result).toEqual({
            video1: [{ videoId: 'video2', score: 1 }],
            video2: [{ videoId: 'video1', score: 1 }],
            video3: [],
        });
    });

    test('returns empty object for empty input', () => {
        const result = generateDescVectorSimilarityMap([]);

        expect(result).toEqual({});
        expect(getEmbeddingByVideoId).not.toHaveBeenCalled();
    });

    test('calls getEmbeddingByVideoId for each video id', () => {
        getEmbeddingByVideoId.mockReturnValue([1, 0]);

        generateDescVectorSimilarityMap(['video1', 'video2', 'video3']);

        expect(getEmbeddingByVideoId).toHaveBeenCalledTimes(3);
        expect(getEmbeddingByVideoId).toHaveBeenNthCalledWith(1, 'video1');
        expect(getEmbeddingByVideoId).toHaveBeenNthCalledWith(2, 'video2');
        expect(getEmbeddingByVideoId).toHaveBeenNthCalledWith(3, 'video3');
    });

    test('returns empty related list for videos without embeddings', () => {
        getEmbeddingByVideoId.mockImplementation((videoId) => {
            const embeddings = {
                video1: [],
                video2: [1, 0],
            };

            return embeddings[videoId] || [];
        });

        const result = generateDescVectorSimilarityMap(['video1', 'video2']);

        expect(result).toEqual({
            video1: [],
            video2: [],
        });
    });
});