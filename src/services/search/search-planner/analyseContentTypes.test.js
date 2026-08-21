const { analyseContentType } = require('./analyseContentTypes');

describe('analyseContentType', () => {
    const testCandidates = [
        {
            query: 'show me documentary about northpole',
            response: {
                contentTypes: ['documentaries'],
                usedWords: ['documentary'],
                remainingWords: 'show me about northpole',
            },
        },
        {
            query: 'play music videos from goa',
            response: {
                contentTypes: ['music_videos'],
                usedWords: ['music', 'videos'],
                remainingWords: 'play from goa',
            },
        },
        {
            query: 'find surveillance footage from office',
            response: {
                contentTypes: ['surveillance'],
                usedWords: ['surveillance', 'footage'],
                remainingWords: 'find from office',
            },
        },
        {
            query: 'show podcasts and lectures',
            response: {
                contentTypes: ['podcasts', 'educational'],
                usedWords: ['podcasts', 'lectures'],
                remainingWords: 'show and',
            },
        },
        {
            query: 'show movie clips and travel vlog',
            response: {
                contentTypes: ['movies', 'shorts', 'travel_vlogs'],
                usedWords: ['movie', 'clips', 'travel', 'vlog'],
                remainingWords: 'show and',
            },
        },
        {
            query: 'need sports games presentation',
            response: {
                contentTypes: ['sports_games', 'work'],
                usedWords: ['sports', 'games', 'presentation'],
                remainingWords: 'need',
            },
        },
        {
            query: 'show home family videos',
            response: {
                contentTypes: ['home_family'],
                usedWords: ['home', 'family'],
                remainingWords: 'show videos',
            },
        },
        {
            query: 'show series documentaries from netflix',
            response: {
                contentTypes: ['shows_series', 'documentaries'],
                usedWords: ['series', 'documentaries'],
                remainingWords: 'show from netflix',
            },
        },
        {
            query: 'find tutorial lecture podcast clips',
            response: {
                contentTypes: ['educational', 'podcasts', 'shorts'],
                usedWords: ['tutorial', 'lecture', 'podcast', 'clips'],
                remainingWords: 'find',
            },
        },
        {
            query: 'show travel vlogs and sports',
            response: {
                contentTypes: ['travel_vlogs', 'sports_games'],
                usedWords: ['travel', 'vlogs', 'sports'],
                remainingWords: 'show and',
            },
        },
        {
            query: 'find surveillance and surveillance footage',
            response: {
                contentTypes: ['surveillance'],
                usedWords: ['surveillance', 'surveillance', 'footage'],
                remainingWords: 'find and',
            },
        },
        {
            query: 'show movies shows podcasts documentaries',
            response: {
                contentTypes: ['movies', 'shows_series', 'podcasts', 'documentaries'],
                usedWords: ['movies', 'shows', 'podcasts', 'documentaries'],
                remainingWords: 'show',
            },
        },
        {
            query: 'show random things from mars',
            response: {
                contentTypes: [],
                usedWords: [],
                remainingWords: 'show random things from mars',
            },
        },
        {
            query: '   show   movie   from   goa   ',
            response: {
                contentTypes: ['movies'],
                usedWords: ['movie'],
                remainingWords: 'show from goa',
            },
        },
        {
            query: '',
            response: {
                contentTypes: [],
                usedWords: [],
                remainingWords: '',
            },
        },
    ];

    testCandidates.forEach(({ query, response }) => {
        it(`should return ${JSON.stringify(response)} for ${query}`, () => {
            expect(analyseContentType(query)).toEqual(response);
        });
    });

    it('should prefer longer phrases before single-word matches', () => {
        expect(analyseContentType('show music video')).toEqual({
            contentTypes: ['music_videos'],
            usedWords: ['music', 'video'],
            remainingWords: 'show',
        });
    });

    it('should not duplicate the same content type when multiple synonyms are present', () => {
        expect(analyseContentType('movie movies')).toEqual({
            contentTypes: ['movies'],
            usedWords: ['movie', 'movies'],
            remainingWords: '',
        });
    });

    it('should match case-insensitively for lookup phrases', () => {
        expect(analyseContentType('Show MUSIC VIDEOS and DOCUMENTARIES')).toEqual({
            contentTypes: ['music_videos', 'documentaries'],
            usedWords: ['MUSIC', 'VIDEOS', 'DOCUMENTARIES'],
            remainingWords: 'Show and',
        });
    });
});
