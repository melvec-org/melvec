const deepEqual = require('./deepEqual.js');

describe('deepEqual', () => {
    test('should return true for identical primitives', () => {
        expect(deepEqual(1, 1)).toBe(true);
        expect(deepEqual('hello', 'hello')).toBe(true);
        expect(deepEqual(null, null)).toBe(true);
        expect(deepEqual(undefined, undefined)).toBe(true);
    });

    test('should return false for different primitives', () => {
        expect(deepEqual(1, 2)).toBe(false);
        expect(deepEqual('a', 'b')).toBe(false);
        expect(deepEqual(true, false)).toBe(false);
        expect(deepEqual(null, undefined)).toBe(false);
    });

    test('should handle NaN correctly', () => {
        expect(deepEqual(NaN, NaN)).toBe(true);
        expect(deepEqual(NaN, 5)).toBe(false);
    });

    test('should return true for identical arrays (order matters)', () => {
        expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    test('should return false for arrays with different order', () => {
        expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
    });

    test('should return false for arrays with different values', () => {
        expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    test('should return true for identical nested arrays/objects', () => {
        const arr1 = [
            { id: 'v1', plays: 5 },
            { id: 'v2', plays: 10 },
        ];
        const arr2 = [
            { id: 'v1', plays: 5 },
            { id: 'v2', plays: 10 },
        ];
        expect(deepEqual(arr1, arr2)).toBe(true);
    });

    test('should return false for different nested arrays/objects', () => {
        const arr1 = [
            { id: 'v1', plays: 5 },
            { id: 'v2', plays: 10 },
        ];
        const arr2 = [
            { id: 'v1', plays: 5 },
            { id: 'v2', plays: 12 },
        ];
        expect(deepEqual(arr1, arr2)).toBe(false);
    });

    test('should return true for identical objects with same key order', () => {
        expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    test('should return false for objects with different key order but same content', () => {
        expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });

    test('should return false for objects with different properties', () => {
        expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    test('should return false for objects with different values', () => {
        expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    });

    test('should return false if types mismatch', () => {
        expect(deepEqual({ a: 1 }, [{ a: 1 }])).toBe(false);
        expect(deepEqual(1, '1')).toBe(false);
    });
});
