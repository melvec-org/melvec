
import sortBy from './sortBy';

describe('sortBy', () => {
    test('should sort numbers in ascending order by a property', () => {
        const arr = [
            { id: 1, value: 30 },
            { id: 2, value: 10 },
            { id: 3, value: 20 }
        ];
        const result = sortBy([...arr], 'value', 'asc');
        expect(result).toEqual([
            { id: 2, value: 10 },
            { id: 3, value: 20 },
            { id: 1, value: 30 }
        ]);
    });

    test('should sort numbers in descending order by a property', () => {
        const arr = [
            { id: 1, value: 30 },
            { id: 2, value: 10 },
            { id: 3, value: 20 }
        ];
        const result = sortBy([...arr], 'value', 'desc');
        expect(result).toEqual([
            { id: 1, value: 30 },
            { id: 3, value: 20 },
            { id: 2, value: 10 }
        ]);
    });

    test('should handle strings and sort alphabetically ascending', () => {
        const arr = [
            { id: 1, name: 'Charlie' },
            { id: 2, name: 'Alice' },
            { id: 3, name: 'Bob' }
        ];
        const result = sortBy([...arr], 'name', 'asc');
        expect(result).toEqual([
            { id: 2, name: 'Alice' },
            { id: 3, name: 'Bob' },
            { id: 1, name: 'Charlie' }
        ]);
    });

    test('should handle strings and sort alphabetically descending', () => {
        const arr = [
            { id: 1, name: 'Charlie' },
            { id: 2, name: 'Alice' },
            { id: 3, name: 'Bob' }
        ];
        const result = sortBy([...arr], 'name', 'desc');
        expect(result).toEqual([
            { id: 1, name: 'Charlie' },
            { id: 3, name: 'Bob' },
            { id: 2, name: 'Alice' }
        ]);
    });

    test('should mutate the original array', () => {
        const arr = [
            { id: 1, value: 2 },
            { id: 2, value: 1 }
        ];
        const result = sortBy(arr, 'value', 'asc');
        expect(result).toBe(arr); // It returns same array instance
    });

    test('should return empty array when given empty array', () => {
        const arr = [];
        const result = sortBy(arr, 'value', 'asc');
        expect(result).toEqual([]);
    });
});
