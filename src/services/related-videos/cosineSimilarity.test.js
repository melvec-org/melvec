const cosineSimilarity = require('./cosineSimilarity');

describe('cosineSimilarity', () => {
    test('returns 1 for identical vectors', () => {
        const tfidfA = { cat: 1, dog: 2, tree: 3 };
        const tfidfB = { cat: 1, dog: 2, tree: 3 };

        expect(cosineSimilarity(tfidfA, tfidfB)).toBeCloseTo(1, 10);
    });

    test('returns correct similarity for partially overlapping vectors', () => {
        const tfidfA = { cat: 1, dog: 1 };
        const tfidfB = { cat: 1, tree: 1 };

        expect(cosineSimilarity(tfidfA, tfidfB)).toBeCloseTo(0.5, 10);
    });

    test('returns 0 for vectors with no overlapping terms', () => {
        const tfidfA = { cat: 1, dog: 2 };
        const tfidfB = { tree: 3, road: 4 };

        expect(cosineSimilarity(tfidfA, tfidfB)).toBe(0);
    });

    test('returns NaN when both vectors are empty', () => {
        expect(cosineSimilarity({}, {})).toBeNaN();
    });

    test('returns NaN when one vector is empty', () => {
        expect(cosineSimilarity({ cat: 1 }, {})).toBeNaN();
        expect(cosineSimilarity({}, { cat: 1 })).toBeNaN();
    });

    test('returns NaN when both vectors have zero magnitude', () => {
        const tfidfA = { cat: 0, dog: 0 };
        const tfidfB = { cat: 0, dog: 0 };

        expect(cosineSimilarity(tfidfA, tfidfB)).toBeNaN();
    });

    test('returns NaN when one vector has zero magnitude', () => {
        const tfidfA = { cat: 0, dog: 0 };
        const tfidfB = { cat: 1, dog: 2 };

        expect(cosineSimilarity(tfidfA, tfidfB)).toBeNaN();
    });

    test('handles decimal TF-IDF scores correctly', () => {
        const tfidfA = { cat: 0.2, dog: 0.8 };
        const tfidfB = { cat: 0.2, dog: 0.8 };

        expect(cosineSimilarity(tfidfA, tfidfB)).toBeCloseTo(1, 10);
    });
});