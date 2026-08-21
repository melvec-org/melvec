const { analyseQuery } = require('./searchPlanner');

describe('analyseQuery', () => {
    const testCandidates = [
        {
            query: '',
            response: {
                query: '',
                constraints: {
                    mediaTypes: [],
                    subjects: [],
                    time: null,
                    locations: [],
                    contentTypes: [],
                },
                remainingWords: '',
            },
        },
        {
            query: 'show me videos',
            response: {
                query: 'show me videos',
                constraints: {
                    mediaTypes: ['video'],
                    subjects: [],
                    time: null,
                    locations: [],
                    contentTypes: [],
                },
                remainingWords: 'show me',
            },
        },
        {
            query: 'show movie clips and travel vlog',
            response: {
                query: 'show movie clips and travel vlog',
                constraints: {
                    mediaTypes: [],
                    subjects: [],
                    time: null,
                    locations: [],
                    contentTypes: ['movies', 'shorts', 'travel_vlogs'],
                },
                remainingWords: 'show and',
            },
        },
        {
            query: 'show me videos from 2025',
            response: {
                query: 'show me videos from 2025',
                constraints: {
                    mediaTypes: ['video'],
                    subjects: [],
                    time: {
                        from: new Date(2025, 0, 1, 0, 0, 0, 0).getTime(),
                        to: new Date(2025, 11, 31, 23, 59, 59, 999).getTime(),
                    },
                    locations: [],
                    contentTypes: [],
                },
                remainingWords: 'show me from',
            },
        },
        {
            query: 'show movie videos from 2025',
            response: {
                query: 'show movie videos from 2025',
                constraints: {
                    mediaTypes: ['video'],
                    subjects: [],
                    time: {
                        from: new Date(2025, 0, 1, 0, 0, 0, 0).getTime(),
                        to: new Date(2025, 11, 31, 23, 59, 59, 999).getTime(),
                    },
                    locations: [],
                    contentTypes: ['movies'],
                },
                remainingWords: 'show from',
            },
        },
    ];

    testCandidates.forEach(({ query, response }) => {
        it(`should return ${JSON.stringify(response)} for ${query}`, () => {
            expect(analyseQuery(query)).toEqual(response);
        });
    });
});
