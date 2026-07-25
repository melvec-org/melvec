
const sortByProp = require('./sortByProp');

describe('sortByProp', () => {
    test('should sort numbers in ascending order by the given property<|fim_suffix|>', () => {
        const arr = [
            { id: 1, value: 30 },
            { id: 2, value: 10 },
            { id: 3, value: 20 }
        ];
        const result = sortByProp(arr, 'value');
        expect(result).toEqual([
            { id: 2, value: 10 },
            { id: 3, value: 20 },
            { id: 1, value: 30 }
        ]);
    });

    test('should handle strings and sort them alphabetically', () => {
        const arr = [
            { id: 1, name: 'Charlie' },
            { id: 2, name: 'Alice' },
            { id: 3, name: 'Bob' }
        ];
        const result = sortByProp(arr, 'name');
        expect(result).toEqual([
            { id: 2, name: 'Alice' },
            { id: 3, name: 'Bob' },
            { id: 1, name: 'Charlie' }
        ]);
    });

    test('should place objects with undefined property values at the end', () => {
        const arr = [
            { id: 1, age: 25 },
            { id: 2 },
            { id: 3, age: 20 }
        ];
        const result = sortByProp(arr, 'age');
        expect(result).toEqual([
            { id: 3, age: 20 },
            { id: 1, age: 25 },
            { id: 2 }
        ]);
    });

    test('should return a new array without mutating the original', () => {
        const arr = [
            { id: 1, score: 50 },
            { id: 2, score: 10 }
        ];
        const copy = [...arr];
        sortByProp(arr, 'score');
        expect(arr).toEqual(copy); // original unchanged
    });

    test('should return empty array when given empty array', () => {
        expect(sortByProp([], 'value')).toEqual([]);
    });

    test('should handle arrays with all undefined property values', () => {
        const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const result = sortByProp(arr, 'missing');
        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });
});
