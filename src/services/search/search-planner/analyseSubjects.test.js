const { analyseSubjects, getSubjectNames } = require('./analyseSubjects');

describe('analyzeSubjects', () => {
    const subjectList = [
        {
            name: 'Mathew Pinto',
            id: 'f43eraASDF',
        },
        {
            name: 'Bruno',
            id: 'f43easraASDF',
        },
        {
            name: 'pradyumna kumar ghose',
            id: 'f43wereraASDF',
        },
        {
            name: 'Mathew Pinto',
            id: 'f43ersr24aASDF',
        },

        {
            name: 'Rahul Sharma',
            id: 'f43er24aASDF',
        },
        {
            name: 'Rahul Mishra',
            id: 'f43er24aASDser',
        },
    ];
    const testCandidates = [
        {
            query: 'show me videos of mathew pinto and bruno in shimla',
            response: {
                subjects: [
                    {
                        name: 'Mathew Pinto',
                        id: 'f43eraASDF',
                    },
                    {
                        name: 'Bruno',
                        id: 'f43easraASDF',
                    },
                ],
                usedWords: ['mathew', 'pinto', 'bruno'],
                remainingWords: 'show me videos of and in shimla',
            },
        },
        {
            query: 'show me videos of pradyumna kumar ghose in shimla',
            response: {
                subjects: [
                    {
                        name: 'pradyumna kumar ghose',
                        id: 'f43wereraASDF',
                    },
                ],
                usedWords: ['pradyumna', 'kumar', 'ghose'],
                remainingWords: 'show me videos of in shimla',
            },
        },
        {
            query: 'show me videos of pradyumna in shimla',
            response: {
                subjects: [
                    {
                        name: 'pradyumna kumar ghose',
                        id: 'f43wereraASDF',
                    },
                ],
                usedWords: ['pradyumna'],
                remainingWords: 'show me videos of in shimla',
            },
        },
        {
            query: 'show me images harshika',
            response: {
                subjects: [],
                usedWords: [],
                remainingWords: 'show me images harshika',
            },
        },
        {
            query: 'Rahul in meghalaya',
            response: {
                subjects: [
                    {
                        name: 'Rahul Sharma',
                        id: 'f43er24aASDF',
                    },
                    {
                        name: 'Rahul Mishra',
                        id: 'f43er24aASDser',
                    },
                ],
                usedWords: ['Rahul'],
                remainingWords: 'in meghalaya',
            },
        },
        {
            query: 'Rahul sharma in meghalaya',
            response: {
                subjects: [
                    {
                        name: 'Rahul Sharma',
                        id: 'f43er24aASDF',
                    },
                ],
                usedWords: ['Rahul', 'sharma'],
                remainingWords: 'in meghalaya',
            },
        },
    ];
    testCandidates.forEach(({ query, response }) => {
        it(`should return ${JSON.stringify(response)} for ${query}`, () => {
            expect(analyseSubjects(query, subjectList)).toEqual(response);
        });
    });
});
