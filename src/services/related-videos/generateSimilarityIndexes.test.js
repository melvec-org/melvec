const { generateSimilarityIndexes } = require('./generateSimilarityIndexes');

describe('generateSimilarityIndexes', () => {
    const videos = [
        { videoId: 'video1', tags: ['action', 'adventure', 'thriller'] },
        { videoId: 'video2', tags: ['action', 'thriller'] },
        { videoId: 'video3', tags: ['comedy', 'drama'] },
        { videoId: 'video4', tags: ['action', 'adventure'] },
        { videoId: 'video5', tags: ['comedy', 'thriller'] },
    ];

    test('should generate correct similarity indexes for videos based on tags', () => {
        const expectedOutput = {
            video1: [
                { videoId: 'video2', score: 0.6666666666666666 },
                { videoId: 'video4', score: 0.6666666666666666 },
                { videoId: 'video5', score: 0.25 },
            ],
            video2: [
                { videoId: 'video1', score: 0.6666666666666666 },
                { videoId: 'video4', score: 0.3333333333333333 },
                { videoId: 'video5', score: 0.3333333333333333 },
            ],
            video3: [{ videoId: 'video5', score: 0.3333333333333333 }],
            video4: [
                { videoId: 'video1', score: 0.6666666666666666 },
                { videoId: 'video2', score: 0.3333333333333333 },
            ],
            video5: [
                { videoId: 'video2', score: 0.3333333333333333 },
                { videoId: 'video3', score: 0.3333333333333333 },
                { videoId: 'video1', score: 0.25 },
            ],
        };

        const relatedVideosMap = generateSimilarityIndexes(videos, 'tags');
        expect(relatedVideosMap).toEqual(expectedOutput);
    });

    test('should handle videos with no tags gracefully', () => {
        const videosWithNoTags = [
            { videoId: 'video1', tags: [] },
            { videoId: 'video2', tags: [] },
        ];
        const relatedVideosMap = generateSimilarityIndexes(videosWithNoTags, 'tags');
        expect(relatedVideosMap).toEqual({
            video1: [],
            video2: [],
        });
    });
});
