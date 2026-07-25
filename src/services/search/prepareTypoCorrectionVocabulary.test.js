jest.mock('../database/videoLibraryDbService', () => ({
    getAllVideoIds: jest.fn(),
    getVideoDetailsById: jest.fn(),
    getVideoTitlesAndDescriptionsByIds: jest.fn(),
}));

jest.mock('../database/metaDataDbService', () => ({
    getMetaDataById: jest.fn(),
}));

jest.mock('../database/tagsDbService', () => ({
    getTags: jest.fn(),
}));

jest.mock('../database/playlistsDbService', () => ({
    getPlaylists: jest.fn(),
}));

jest.mock('../image-library/imageLibrary', () => ({
    getAllImageIds: jest.fn(),
    getFullImageDetailsById: jest.fn(),
}));

jest.mock('../database/imageLibraryDbService', () => ({
    getImageDetailsById: jest.fn(),
    getImageDescriptionById: jest.fn(),
    getImageTitlesAndDescriptionsByIds: jest.fn(),
}));

jest.mock('../database/vocabularyDbServices', () => ({
    saveVocabulary: jest.fn(),
    getVocabulary: jest.fn(),
}));

const { getAllVideoIds, getVideoDetailsById, getVideoTitlesAndDescriptionsByIds } = require('../database/videoLibraryDbService');
const { getMetaDataById } = require('../database/metaDataDbService');
const { getTags } = require('../database/tagsDbService');
const { getPlaylists } = require('../database/playlistsDbService');
const { getAllImageIds } = require('../image-library/imageLibrary');
const { getImageTitlesAndDescriptionsByIds } = require('../database/imageLibraryDbService');

const {
    addTextsToVocabulary,
    prepareTypoCorrectionVocabulary,
    extractSearchableTextsFromVideo,
    prepareTypoCorrectionVocabularyFromDb,
} = require('./prepareTypoCorrectionVocabulary');

describe('addTextsToVocabulary', () => {
    test('should add normalized unique tokens into the provided set', () => {
        const vocabulary = new Set(['existing']);

        addTextsToVocabulary(vocabulary, ['The quick brown fox', 'quick brown dog', null, 42], {
            minVocabularyTokenLength: 3,
            maxTokenLength: 40,
        });

        expect([...vocabulary]).toEqual(['existing', 'quick', 'brown', 'fox', 'dog']);
    });
});

describe('prepareTypoCorrectionVocabulary', () => {
    test('should extract and deduplicate tokens across texts', () => {
        const result = prepareTypoCorrectionVocabulary(['The quick brown fox', 'quick brown dog', 'fox 2024'], {
            minVocabularyTokenLength: 3,
            maxTokenLength: 40,
        });

        expect(result).toEqual(['quick', 'brown', 'fox', 'dog']);
    });

    test('should ignore non-string values', () => {
        const result = prepareTypoCorrectionVocabulary(['constantine', null, undefined, 123, { text: 'mathematics' }], {
            minVocabularyTokenLength: 3,
            maxTokenLength: 40,
        });

        expect(result).toEqual(['constantine']);
    });

    test('should respect tokenization options', () => {
        const result = prepareTypoCorrectionVocabulary(['cat lion tiger'], {
            minVocabularyTokenLength: 4,
            maxTokenLength: 40,
        });

        expect(result).toEqual(['lion', 'tiger']);
    });
});

describe('extractSearchableTextsFromVideo', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should collect title and metadata description for a video id', () => {
        getVideoDetailsById.mockReturnValue({
            title: 'Constantine',
        });
        getMetaDataById.mockReturnValue({
            description: 'Occult detective story',
        });

        const result = extractSearchableTextsFromVideo('video-1');

        expect(getVideoDetailsById).toHaveBeenCalledWith('video-1');
        expect(getMetaDataById).toHaveBeenCalledWith('video-1');
        expect(result).toEqual(['Constantine', 'Occult detective story']);
    });

    test('should return empty array for missing video id', () => {
        const result = extractSearchableTextsFromVideo();

        expect(result).toEqual([]);
        expect(getVideoDetailsById).not.toHaveBeenCalled();
        expect(getMetaDataById).not.toHaveBeenCalled();
    });

    test('should ignore missing title and missing description', () => {
        getVideoDetailsById.mockReturnValue({});
        getMetaDataById.mockReturnValue({});

        const result = extractSearchableTextsFromVideo('video-2');

        expect(result).toEqual([]);
    });
});

describe('prepareTypoCorrectionVocabularyFromDb', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should build vocabulary from videos, images, tags, and playlists', () => {
        getAllVideoIds.mockReturnValue(['v1', 'v2']);
        getVideoTitlesAndDescriptionsByIds.mockReturnValue([
            { title: 'Constantine', description: 'Occult detective story' },
            { title: 'Mathematics for kids', description: 'Learn mathematics easily' },
        ]);
        getAllImageIds.mockReturnValue(['i1']);
        getImageTitlesAndDescriptionsByIds.mockReturnValue([{ title: 'Forest trail', description: 'Morning sunlight' }]);

        getTags.mockReturnValue([
            { id: 't1', label: 'Fantasy' },
            { id: 't2', label: 'Education' },
        ]);

        getPlaylists.mockReturnValue([{ id: 'p1', label: 'Weekend Watchlist' }]);

        const result = prepareTypoCorrectionVocabularyFromDb({
            minVocabularyTokenLength: 3,
            maxTokenLength: 40,
        });

        expect(getAllVideoIds).toHaveBeenCalled();
        expect(getVideoTitlesAndDescriptionsByIds).toHaveBeenCalledWith(['v1', 'v2']);
        expect(getAllImageIds).toHaveBeenCalled();
        expect(getImageTitlesAndDescriptionsByIds).toHaveBeenCalledWith(['i1']);
        expect(getTags).toHaveBeenCalled();
        expect(getPlaylists).toHaveBeenCalled();

        expect(result).toEqual(
            expect.arrayContaining([
                'constantine',
                'mathematics',
                'kids',
                'occult',
                'detective',
                'story',
                'learn',
                'easily',
                'forest',
                'trail',
                'morning',
                'sunlight',
                'fantasy',
                'education',
                'weekend',
                'watchlist',
            ]),
        );
    });

    test('should handle empty and invalid tag and playlist labels safely', () => {
        getAllVideoIds.mockReturnValue([]);
        getTags.mockReturnValue([null, {}, { label: '' }, { label: 'Drama' }]);
        getPlaylists.mockReturnValue([null, {}, { label: ' ' }, { label: 'Top Picks' }]);

        const result = prepareTypoCorrectionVocabularyFromDb({
            minVocabularyTokenLength: 3,
            maxTokenLength: 40,
        });

        expect(result).toEqual(expect.arrayContaining(['drama', 'top', 'picks']));
    });

    test('should return empty array when all data sources are empty', () => {
        getAllVideoIds.mockReturnValue([]);
        getTags.mockReturnValue([]);
        getPlaylists.mockReturnValue([]);

        const result = prepareTypoCorrectionVocabularyFromDb({
            minVocabularyTokenLength: 3,
            maxTokenLength: 40,
        });

        expect(result).toEqual(['forest', 'trail', 'morning', 'sunlight']);
    });
});
