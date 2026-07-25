const {
    normalizeForComparison,
    damerauLevenshtein,
    getNormalizedEditScore,
} = require('./stringSimilarity');

describe('stringSimilarity', () => {
    describe('normalizeForComparison', () => {
        test('should lowercase, trim, and normalize punctuation to spaces', () => {
            expect(normalizeForComparison('  The_QUICK, Brown!  ')).toBe('the quick brown');
        });

        test('should collapse repeated spaces', () => {
            expect(normalizeForComparison('one     two   three')).toBe('one two three');
        });

        test('should return empty string for empty input', () => {
            expect(normalizeForComparison('')).toBe('');
            expect(normalizeForComparison(null)).toBe('');
            expect(normalizeForComparison(undefined)).toBe('');
        });
    });

    describe('damerauLevenshtein', () => {
        test('should return 0 for identical strings', () => {
            expect(damerauLevenshtein('constantine', 'constantine')).toBe(0);
        });

        test('should handle single substitution', () => {
            expect(damerauLevenshtein('cat', 'cut')).toBe(1);
        });

        test('should handle single insertion or deletion', () => {
            expect(damerauLevenshtein('cat', 'cats')).toBe(1);
            expect(damerauLevenshtein('cats', 'cat')).toBe(1);
        });

        test('should handle adjacent transposition', () => {
            expect(damerauLevenshtein('ab', 'ba')).toBe(1);
        });

        test('should normalize input before computing distance', () => {
            expect(damerauLevenshtein('  Constantine! ', 'constantine')).toBe(0);
        });
    });

    describe('getNormalizedEditScore', () => {
        test('should return 1 for identical strings', () => {
            expect(getNormalizedEditScore('constantine', 'constantine')).toBe(1);
        });

        test('should return lower score for weaker matches', () => {
            const strongScore = getNormalizedEditScore('contsenine', 'constantine');
            const weakScore = getNormalizedEditScore('contsenine', 'mathematics');

            expect(strongScore).toBeGreaterThan(weakScore);
        });

        test('should normalize input before scoring', () => {
            expect(getNormalizedEditScore('  CONSTANTINE! ', 'constantine')).toBe(1);
        });
    });
});