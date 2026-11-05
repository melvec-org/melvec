const systemConfig = require('../../configs/systemConfig');
const { isValidMediaTimestamp, getPreferredMediaTimestamp, getYearFromTime, getFileYear } = require('./timeUtils');

describe('timeUtils', () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const pastTimestamp = new Date('2020-05-15T12:00:00.000Z').getTime();
    const futureTimestamp = new Date('2024-01-01T00:00:01.000Z').getTime();

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(now);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('isValidMediaTimestamp', () => {
        test('returns false for missing values', () => {
            expect(isValidMediaTimestamp(null)).toBe(false);
            expect(isValidMediaTimestamp(undefined)).toBe(false);
            expect(isValidMediaTimestamp('')).toBe(false);
        });

        test('returns false for non-numeric, zero, and negative values', () => {
            expect(isValidMediaTimestamp('abc')).toBe(false);
            expect(isValidMediaTimestamp(0)).toBe(false);
            expect(isValidMediaTimestamp(-1)).toBe(false);
        });

        test('returns true for past numeric timestamps and numeric strings', () => {
            expect(isValidMediaTimestamp(pastTimestamp)).toBe(true);
            expect(isValidMediaTimestamp(String(pastTimestamp))).toBe(true);
        });

        test('rejects future timestamps unless they are within the allowed tolerance', () => {
            expect(isValidMediaTimestamp(futureTimestamp)).toBe(false);
            expect(isValidMediaTimestamp(futureTimestamp, 1000)).toBe(true);
        });
    });

    describe('getPreferredMediaTimestamp', () => {
        test('returns the first valid timestamp', () => {
            const first = new Date('2019-01-01T00:00:00.000Z').getTime();
            const second = new Date('2020-01-01T00:00:00.000Z').getTime();

            expect(getPreferredMediaTimestamp(first, second)).toBe(first);
        });

        test('skips invalid and future candidates before returning a valid fallback', () => {
            expect(getPreferredMediaTimestamp(null, 'bad', futureTimestamp, pastTimestamp)).toBe(pastTimestamp);
        });

        test('returns null when no candidate is valid', () => {
            expect(getPreferredMediaTimestamp(null, undefined, '', 'bad', futureTimestamp)).toBe(null);
        });
    });

    describe('getYearFromTime', () => {
        test('returns the actual year for a valid timestamp', () => {
            expect(getYearFromTime(pastTimestamp)).toBe(2020);
        });

        test('returns the default collection year for invalid or future input', () => {
            expect(getYearFromTime('bad')).toBe(systemConfig.DEFAULT_COLLECTION_YEAR);
            expect(getYearFromTime(futureTimestamp)).toBe(systemConfig.DEFAULT_COLLECTION_YEAR);
        });
    });

    describe('getFileYear', () => {
        test('uses the same year logic as getYearFromTime', () => {
            expect(getFileYear(pastTimestamp)).toBe(getYearFromTime(pastTimestamp));
            expect(getFileYear(null)).toBe(systemConfig.DEFAULT_COLLECTION_YEAR);
        });
    });
});
