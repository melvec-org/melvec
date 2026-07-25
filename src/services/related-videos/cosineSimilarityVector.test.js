const cosineSimilarityVector = require('./cosineSimilarityVector');

describe('cosineSimilarityVector', () => {
    test('returns 1 for identical vectors', () => {
        expect(cosineSimilarityVector([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    });

    test('returns 0 for orthogonal vectors', () => {
        expect(cosineSimilarityVector([1, 0], [0, 1])).toBe(0);
    });

    test('returns correct similarity for partially aligned vectors', () => {
        const result = cosineSimilarityVector([1, 1], [1, 0]);
        expect(result).toBeCloseTo(0.7071067812, 10);
    });

    test('returns 0 when one vector is empty', () => {
        expect(cosineSimilarityVector([], [1, 2, 3])).toBe(0);
        expect(cosineSimilarityVector([1, 2, 3], [])).toBe(0);
    });

    test('returns 0 when both vectors are empty', () => {
        expect(cosineSimilarityVector([], [])).toBe(0);
    });

    test('returns 0 when one vector has zero magnitude', () => {
        expect(cosineSimilarityVector([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    test('returns 0 when both vectors have zero magnitude', () => {
        expect(cosineSimilarityVector([0, 0], [0, 0])).toBe(0);
    });

    test('throws when inputs are not arrays', () => {
        expect(() => cosineSimilarityVector(null, [1, 2])).toThrow('cosineSimilarityVector expects two arrays');
        expect(() => cosineSimilarityVector([1, 2], null)).toThrow('cosineSimilarityVector expects two arrays');
        expect(() => cosineSimilarityVector({}, [1, 2])).toThrow('cosineSimilarityVector expects two arrays');
    });

    test('throws when vectors have different lengths', () => {
        expect(() => cosineSimilarityVector([1, 2], [1])).toThrow('Vectors must have the same length');
    });

    test('handles numeric strings', () => {
        expect(cosineSimilarityVector(['1', '2'], ['1', '2'])).toBeCloseTo(1, 10);
    });

    test('treats non-numeric values as 0', () => {
        const result = cosineSimilarityVector([1, 'abc', 3], [1, 2, 3]);
        expect(result).toBeCloseTo(0.8451542547, 10);
    });
});