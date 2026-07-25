// write test case for sortBYOccuranceAndInndex
import sortByOccuranceAndIndex from './sortByOccurenceAndIndex';

describe('sortByOccuranceAndIndex', () => {
    test('returns an empty array when input is empty', () => {
        const input = [];
        const expectedOutput = [];
        expect(sortByOccuranceAndIndex(input)).toEqual(expectedOutput);
    });

    test('returns a sorted array based on occurrence count and max time', () => {
        const input = ['apple', 'banana', 'apple', 'cherry', 'banana', 'apple'];
        const expectedOutput = ['apple', 'banana', 'cherry'];
        expect(sortByOccuranceAndIndex(input)).toEqual(expectedOutput);
    });

    test('handles duplicate keywords with different times', () => {
        const input = ['apple', 'banana', 'apple', 'cherry', 'banana', 'apple', 'banana'];
        const expectedOutput = ['banana', 'apple', 'cherry'];
        expect(sortByOccuranceAndIndex(input)).toEqual(expectedOutput);
    });
});
