import { getReadableFileSizeString } from './getReadableFileSizeString';

describe('getReadableFileSizeString', () => {
    it('formats bytes into a readable kilobyte string', () => {
        expect(getReadableFileSizeString(1024)).toBe('1.0 kB');
    });

    it('formats megabytes correctly', () => {
        expect(getReadableFileSizeString(1024 * 1024)).toBe('1.0 MB');
    });

    it('returns the minimum displayed value for zero bytes', () => {
        expect(getReadableFileSizeString(0)).toBe('0.1 kB');
    });
});