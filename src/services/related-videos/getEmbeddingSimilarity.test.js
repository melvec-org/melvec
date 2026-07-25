jest.mock('../database/metaDataDbService', () => ({
    getEmbeddingByVideoId: jest.fn(),
}));

jest.mock('./cosineSimilarityVector', () => jest.fn());

const { getEmbeddingByVideoId } = require('../database/metaDataDbService');
const cosineSimilarityVector = require('./cosineSimilarityVector');
const { getEmbeddingSimilarity } = require('./getEmbeddingSimilarity');

describe('getEmbeddingSimilarity', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns 0 when source embedding is empty', () => {
        getEmbeddingByVideoId.mockImplementation((videoId) => {
            const embeddingMap = {
                video1: [],
                video2: [1, 0, 1],
            };

            return embeddingMap[videoId];
        });

        const result = getEmbeddingSimilarity('video1', 'video2');

        expect(result).toBe(0);
        expect(cosineSimilarityVector).not.toHaveBeenCalled();
    });

    test('returns 0 when candidate embedding is empty', () => {
        getEmbeddingByVideoId.mockImplementation((videoId) => {
            const embeddingMap = {
                video1: [1, 0, 1],
                video2: [],
            };

            return embeddingMap[videoId];
        });

        const result = getEmbeddingSimilarity('video1', 'video2');

        expect(result).toBe(0);
        expect(cosineSimilarityVector).not.toHaveBeenCalled();
    });

    test('returns cosine similarity when both embeddings exist', () => {
        getEmbeddingByVideoId.mockImplementation((videoId) => {
            const embeddingMap = {
                video1: [1, 0, 1],
                video2: [1, 1, 0],
            };

            return embeddingMap[videoId];
        });

        cosineSimilarityVector.mockReturnValue(0.5);

        const result = getEmbeddingSimilarity('video1', 'video2');

        expect(result).toBe(0.5);
        expect(cosineSimilarityVector).toHaveBeenCalledTimes(1);
        expect(cosineSimilarityVector).toHaveBeenCalledWith([1, 0, 1], [1, 1, 0]);
    });

    test('fetches embeddings for both source and candidate video ids', () => {
        getEmbeddingByVideoId.mockImplementation((videoId) => {
            const embeddingMap = {
                sourceVideo: [0.1, 0.2],
                candidateVideo: [0.3, 0.4],
            };

            return embeddingMap[videoId];
        });

        cosineSimilarityVector.mockReturnValue(0.123);

        getEmbeddingSimilarity('sourceVideo', 'candidateVideo');

        expect(getEmbeddingByVideoId).toHaveBeenCalledTimes(2);
        expect(getEmbeddingByVideoId).toHaveBeenNthCalledWith(1, 'sourceVideo');
        expect(getEmbeddingByVideoId).toHaveBeenNthCalledWith(2, 'candidateVideo');
    });

    test('passes embeddings to cosineSimilarityVector in correct order', () => {
        getEmbeddingByVideoId.mockImplementation((videoId) => {
            const embeddingMap = {
                sourceVideo: [1, 2, 3],
                candidateVideo: [4, 5, 6],
            };

            return embeddingMap[videoId];
        });

        cosineSimilarityVector.mockReturnValue(0.9746);

        getEmbeddingSimilarity('sourceVideo', 'candidateVideo');

        expect(cosineSimilarityVector).toHaveBeenCalledWith([1, 2, 3], [4, 5, 6]);
    });
});