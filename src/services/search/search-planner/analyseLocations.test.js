const { analyseLocations } = require('./analyseLocations');

describe('analyseLocations', () => {
    const locationsList = [
        {
            id: 'loc_1',
            name: 'Jaipur Rajasthan',
        },
        {
            id: 'loc_2',
            name: 'Shimla Himachal',
        },
        {
            id: 'loc_3',
            name: 'Springfield Illinois',
        },
        {
            id: 'loc_4',
            name: 'Springfield Missouri',
        },
        {
            id: 'loc_1',
            name: 'Pink City',
        },
    ];

    const testCandidates = [
        {
            query: 'show me videos from jaipur rajasthan in 2025',
            response: {
                locations: [
                    {
                        id: 'loc_1',
                        name: 'Jaipur Rajasthan',
                    },
                ],
                usedWords: ['jaipur', 'rajasthan'],
                remainingWords: 'show me videos from in 2025',
            },
        },
        {
            query: 'show me videos from jaipur in 2025',
            response: {
                locations: [
                    {
                        id: 'loc_1',
                        name: 'Jaipur Rajasthan',
                    },
                ],
                usedWords: ['jaipur'],
                remainingWords: 'show me videos from in 2025',
            },
        },
        {
            query: 'show me videos from springfield in 2025',
            response: {
                locations: [
                    {
                        id: 'loc_3',
                        name: 'Springfield Illinois',
                    },
                    {
                        id: 'loc_4',
                        name: 'Springfield Missouri',
                    },
                ],
                usedWords: ['springfield'],
                remainingWords: 'show me videos from in 2025',
            },
        },
        {
            query: 'show me videos from springfield illinois in 2025',
            response: {
                locations: [
                    {
                        id: 'loc_3',
                        name: 'Springfield Illinois',
                    },
                ],
                usedWords: ['springfield', 'illinois'],
                remainingWords: 'show me videos from in 2025',
            },
        },
        {
            query: 'show me videos from pink city in 2025',
            response: {
                locations: [
                    {
                        id: 'loc_1',
                        name: 'Pink City',
                    },
                ],
                usedWords: ['pink', 'city'],
                remainingWords: 'show me videos from in 2025',
            },
        },
        {
            query: 'show me videos from nowhere in 2025',
            response: {
                locations: [],
                usedWords: [],
                remainingWords: 'show me videos from nowhere in 2025',
            },
        },
    ];

    testCandidates.forEach(({ query, response }) => {
        it(`should return ${JSON.stringify(response)} for ${query}`, () => {
            expect(analyseLocations(query, locationsList)).toEqual(response);
        });
    });
});
