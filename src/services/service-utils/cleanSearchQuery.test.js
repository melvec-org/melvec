const { cleanSearchTerms, buildNearQuery } = require('./cleanSearchQuery');

describe('cleanSearchQuery', () => {
    describe('cleanSearchTerms', () => {
        test('normalizes punctuation, casing, and stop words', () => {
            expect(cleanSearchTerms('  The, QUICK! brown fox  ')).toEqual(['quick', 'brown', 'fox']);
        });

        test('removes one-character words and returns null when no valid terms remain', () => {
            expect(cleanSearchTerms('a i x')).toBeNull();
            expect(cleanSearchTerms('an the to')).toBeNull();
        });

        test('retains numeric and underscore-containing searchable words', () => {
            expect(cleanSearchTerms('Episode_01 season2')).toEqual(['episode_01', 'season2']);
        });
    });

    describe('buildNearQuery', () => {
        test('returns an empty quoted token for invalid or empty inputs', () => {
            expect(buildNearQuery([])).toBe('""');
            expect(buildNearQuery(null)).toBe('""');
            expect(buildNearQuery(['', '   '])).toBe('""');
        });

        test('returns a quoted token for a single term', () => {
            expect(buildNearQuery(['hello'])).toBe('"hello"');
        });

        test('builds NEAR queries for multiple terms', () => {
            expect(buildNearQuery(['hello', 'world'], 5)).toBe('NEAR("hello" "world", 5)');
        });

        test('escapes embedded quotes and normalizes proximity', () => {
            expect(buildNearQuery(['say "hi"', 'there'])).toBe('NEAR("say ""hi""" "there", 10)');
            expect(buildNearQuery(['one', 'two'], 0)).toBe('NEAR("one" "two", 1)');
            expect(buildNearQuery(['one', 'two'], 2.9)).toBe('NEAR("one" "two", 2)');
            expect(buildNearQuery(['one', 'two'], Number.POSITIVE_INFINITY)).toBe('NEAR("one" "two", 10)');
        });
    });
});
