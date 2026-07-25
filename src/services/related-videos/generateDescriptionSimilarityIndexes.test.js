jest.mock('../database/metaDataDbService', () => ({
    getVideoDescriptionsChunk: jest.fn(),
}));

const { getVideoDescriptionsChunk } = require('../database/metaDataDbService');
const {
    preprocessDescription,
    buildInvertedIndex,
    generateDescriptionSimilarityIndexes,
    generateDescriptionSimilarityIndexesFromDbAsync,
} = require('./generateDescriptionSimilarityIndexes');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('preprocessDescription', () => {
    test('should lowercase, remove punctuation, and filter stop words', () => {
        const result = preprocessDescription('The QUICK, brown fox jumps in the room!');

        expect(result).toEqual(['quick', 'brown', 'fox', 'jumps', 'room']);
    });

    test('should return empty array for empty description', () => {
        expect(preprocessDescription('')).toEqual([]);
        expect(preprocessDescription(null)).toEqual([]);
        expect(preprocessDescription(undefined)).toEqual([]);
    });

    test('should limit unique tokens by maxUniqueTokens', () => {
        const result = preprocessDescription('one two three four five six', {
            maxUniqueTokens: 3,
        });

        expect(result).toEqual(['one', 'two', 'three']);
    });

    test('should deduplicate repeated tokens while preserving first occurrence order', () => {
        const result = preprocessDescription('cat dog cat bird dog fish', {
            maxUniqueTokens: 10,
        });

        expect(result).toEqual(['cat', 'dog', 'bird', 'fish']);
    });
});

describe('buildInvertedIndex', () => {
    test('should build term to videoId postings map', () => {
        const videoTokensMap = new Map([
            ['video1', new Set(['cat', 'dog'])],
            ['video2', new Set(['dog', 'bird'])],
            ['video3', new Set(['cat'])],
        ]);

        const index = buildInvertedIndex(videoTokensMap);

        expect(Array.from(index.get('cat'))).toEqual(['video1', 'video3']);
        expect(Array.from(index.get('dog'))).toEqual(['video1', 'video2']);
        expect(Array.from(index.get('bird'))).toEqual(['video2']);
    });

    test('should respect maxPostingsPerTerm cap', () => {
        const videoTokensMap = new Map([
            ['video1', new Set(['shared'])],
            ['video2', new Set(['shared'])],
            ['video3', new Set(['shared'])],
        ]);

        const index = buildInvertedIndex(videoTokensMap, 2);

        expect(Array.from(index.get('shared'))).toEqual(['video1', 'video2']);
    });
});

describe('generateDescriptionSimilarityIndexes', () => {
    test('should generate similarity indexes in { videoId, score } format', () => {
        const videos = [
            { videoId: 'video1', description: 'cat dog garden' },
            { videoId: 'video2', description: 'cat dog house' },
            { videoId: 'video3', description: 'car road highway' },
            { videoId: 'video4', description: 'cat garden tree' },
            { videoId: 'video5', description: 'dog comedy thriller' },
        ];

        const expectedOutput = {
            video1: [
                { videoId: 'video2', score: 0.5 },
                { videoId: 'video4', score: 0.5 },
                { videoId: 'video5', score: 0.2 },
            ],
            video2: [
                { videoId: 'video1', score: 0.5 },
                { videoId: 'video4', score: 0.2 },
                { videoId: 'video5', score: 0.2 },
            ],
            video3: [],
            video4: [
                { videoId: 'video1', score: 0.5 },
                { videoId: 'video2', score: 0.2 },
            ],
            video5: [
                { videoId: 'video1', score: 0.2 },
                { videoId: 'video2', score: 0.2 },
            ],
        };

        const relatedVideosMap = generateDescriptionSimilarityIndexes(videos);
        expect(relatedVideosMap).toEqual(expectedOutput);
    });

    test('should handle videos with no descriptions gracefully', () => {
        const videos = [
            { videoId: 'video1', description: '' },
            { videoId: 'video2', description: '' },
        ];

        const relatedVideosMap = generateDescriptionSimilarityIndexes(videos);

        expect(relatedVideosMap).toEqual({
            video1: [],
            video2: [],
        });
    });

    test('should still return related videos when maxCandidatePostingsPerTerm is disabled', () => {
        const videos = [
            { videoId: 'video1', description: 'cat dog garden' },
            { videoId: 'video2', description: 'cat dog house' },
            { videoId: 'video3', description: 'car road highway' },
            { videoId: 'video4', description: 'cat garden tree' },
        ];

        const result = generateDescriptionSimilarityIndexes(videos, {
            topN: 2,
            maxCandidatePostingsPerTerm: 0,
        });

        expect(result.video1).toEqual([
            { videoId: 'video2', score: 0.5 },
            { videoId: 'video4', score: 0.5 },
        ]);
    });

    test('should respect topN', () => {
        const videos = [
            { videoId: 'video1', description: 'cat dog tree garden' },
            { videoId: 'video2', description: 'cat dog tree' },
            { videoId: 'video3', description: 'cat dog' },
            { videoId: 'video4', description: 'cat' },
        ];

        const result = generateDescriptionSimilarityIndexes(videos, { topN: 1 });

        expect(result.video1).toHaveLength(1);
        expect(result.video1[0]).toEqual({
            videoId: 'video2',
            score: 0.75,
        });
    });

    test('should skip very common candidate terms when maxCandidatePostingsPerTerm is set', () => {
        const videos = [
            { videoId: 'video1', description: 'shared rare1' },
            { videoId: 'video2', description: 'shared rare2' },
            { videoId: 'video3', description: 'shared rare3' },
            { videoId: 'video4', description: 'shared rare1' },
        ];

        const result = generateDescriptionSimilarityIndexes(videos, {
            topN: 5,
            maxCandidatePostingsPerTerm: 2,
        });

        expect(result.video1).toEqual([
            { videoId: 'video4', score: 1 },
        ]);
        expect(result.video2).toEqual([]);
        expect(result.video3).toEqual([]);
        expect(result.video4).toEqual([
            { videoId: 'video1', score: 1 },
        ]);
    });

    test('should fall back to all tokens if candidate-term filtering removes everything', () => {
        const videos = [
            { videoId: 'video1', description: 'shared common' },
            { videoId: 'video2', description: 'shared common' },
        ];

        const result = generateDescriptionSimilarityIndexes(videos, {
            topN: 5,
            maxCandidatePostingsPerTerm: 1,
        });

        expect(result.video1).toEqual([
            { videoId: 'video2', score: 1 },
        ]);
        expect(result.video2).toEqual([
            { videoId: 'video1', score: 1 },
        ]);
    });
});

describe('generateDescriptionSimilarityIndexesFromDbAsync', () => {
    test('should throw if videoIds is not an array', async () => {
        await expect(generateDescriptionSimilarityIndexesFromDbAsync(null)).rejects.toThrow(
            'generateDescriptionSimilarityIndexesFromDbAsync: videoIds must be an array',
        );
    });

    test('should return empty related list for videos with no descriptions', async () => {
        getVideoDescriptionsChunk.mockImplementation(async (ids) =>
            ids.map((videoId) => ({
                videoId,
                description: '',
            })),
        );

        const result = await generateDescriptionSimilarityIndexesFromDbAsync(['video1', 'video2']);

        expect(result).toEqual({
            video1: [],
            video2: [],
        });
    });

    test('should generate similarity indexes in { videoId, score } format from DB chunks', async () => {
        const data = {
            video1: 'cat dog garden',
            video2: 'cat dog house',
            video3: 'car road highway',
            video4: 'cat garden tree',
            video5: 'dog comedy thriller',
        };

        const expectedOutput = {
            video1: [
                { videoId: 'video2', score: 0.5 },
                { videoId: 'video4', score: 0.5 },
                { videoId: 'video5', score: 0.2 },
            ],
            video2: [
                { videoId: 'video1', score: 0.5 },
                { videoId: 'video4', score: 0.2 },
                { videoId: 'video5', score: 0.2 },
            ],
            video3: [],
            video4: [
                { videoId: 'video1', score: 0.5 },
                { videoId: 'video2', score: 0.2 },
            ],
            video5: [
                { videoId: 'video1', score: 0.2 },
                { videoId: 'video2', score: 0.2 },
            ],
        };

        getVideoDescriptionsChunk.mockImplementation(async (ids) =>
            ids.map((videoId) => ({
                videoId,
                description: data[videoId],
            })),
        );

        const result = await generateDescriptionSimilarityIndexesFromDbAsync(
            ['video1', 'video2', 'video3', 'video4', 'video5'],
            { chunkSize: 2 },
        );

        expect(result).toEqual(expectedOutput);
    });

    test('should generate related videos from chunked DB reader', async () => {
        const data = {
            video1: 'cat dog garden',
            video2: 'cat dog house',
            video3: 'car road highway',
            video4: 'cat garden tree',
        };

        getVideoDescriptionsChunk.mockImplementation(async (ids) =>
            ids.map((videoId) => ({
                videoId,
                description: data[videoId],
            })),
        );

        const result = await generateDescriptionSimilarityIndexesFromDbAsync(
            ['video1', 'video2', 'video3', 'video4'],
            { topN: 2, chunkSize: 2 },
        );

        expect(result.video1).toEqual([
            { videoId: 'video2', score: 0.5 },
            { videoId: 'video4', score: 0.5 },
        ]);
        expect(result.video2).toEqual([
            { videoId: 'video1', score: 0.5 },
            { videoId: 'video4', score: 0.2 },
        ]);
        expect(result.video3).toEqual([]);
        expect(result.video4).toEqual([
            { videoId: 'video1', score: 0.5 },
            { videoId: 'video2', score: 0.2 },
        ]);
    });

    test('should apply maxCandidatePostingsPerTerm in DB-backed generation', async () => {
        const data = {
            video1: 'shared rare1',
            video2: 'shared rare2',
            video3: 'shared rare3',
            video4: 'shared rare1',
        };

        getVideoDescriptionsChunk.mockImplementation(async (ids) =>
            ids.map((videoId) => ({
                videoId,
                description: data[videoId],
            })),
        );

        const result = await generateDescriptionSimilarityIndexesFromDbAsync(
            ['video1', 'video2', 'video3', 'video4'],
            {
                topN: 5,
                chunkSize: 2,
                maxCandidatePostingsPerTerm: 2,
            },
        );

        expect(result.video1).toEqual([
            { videoId: 'video4', score: 1 },
        ]);
        expect(result.video2).toEqual([]);
        expect(result.video3).toEqual([]);
        expect(result.video4).toEqual([
            { videoId: 'video1', score: 1 },
        ]);
    });

    test('should handle missing rows from getVideoDescriptionsChunk', async () => {
        getVideoDescriptionsChunk.mockImplementation(async (ids) =>
            ids
                .filter((id) => id === 'video1')
                .map((videoId) => ({
                    videoId,
                    description: 'cat dog garden',
                })),
        );

        const result = await generateDescriptionSimilarityIndexesFromDbAsync(['video1', 'video2'], {
            chunkSize: 1,
        });

        expect(result).toEqual({
            video1: [],
            video2: [],
        });
    });

    test('should report progress for tokenizing, indexing, and scoring', async () => {
        const progressCalls = [];

        getVideoDescriptionsChunk.mockImplementation(async (ids) =>
            ids.map((videoId) => ({
                videoId,
                description: 'cat dog garden',
            })),
        );

        await generateDescriptionSimilarityIndexesFromDbAsync(['video1', 'video2'], {
            chunkSize: 1,
            onProgress: (progress) => progressCalls.push(progress),
        });

        expect(progressCalls.some((item) => item.phase === 'tokenizing')).toBe(true);
        expect(progressCalls.some((item) => item.phase === 'indexing')).toBe(true);
        expect(progressCalls.some((item) => item.phase === 'scoring')).toBe(true);
    });

    test('should produce same output as in-memory version for same dataset', async () => {
        const videos = [
            { videoId: 'video1', description: 'cat dog garden' },
            { videoId: 'video2', description: 'cat dog house' },
            { videoId: 'video3', description: 'car road highway' },
            { videoId: 'video4', description: 'cat garden tree' },
        ];

        const syncResult = generateDescriptionSimilarityIndexes(videos, {
            topN: 3,
            chunkSize: 2,
            maxUniqueTokens: 100,
            maxPostingsPerTerm: 5000,
        });

        getVideoDescriptionsChunk.mockImplementation(async (ids) =>
            videos.filter((video) => ids.includes(video.videoId)),
        );

        const asyncResult = await generateDescriptionSimilarityIndexesFromDbAsync(
            videos.map((v) => v.videoId),
            {
                topN: 3,
                chunkSize: 2,
                maxUniqueTokens: 100,
                maxPostingsPerTerm: 5000,
            },
        );

        expect(asyncResult).toEqual(syncResult);
    });
});
