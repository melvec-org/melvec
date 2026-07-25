const toBase62 = require('./toBase62');

describe('toBase62', () => {
    test('encodes known values into base62', () => {
        expect(toBase62(0n)).toBe('0');
        expect(toBase62(1n)).toBe('1');
        expect(toBase62(61n)).toBe('Z');
        expect(toBase62(62n)).toBe('10');
        expect(toBase62(3844n)).toBe('100');
    });

    test('encodes larger values deterministically', () => {
        expect(toBase62(238327n)).toBe('ZZZ');
        expect(toBase62(238328n)).toBe('1000');
    });
});
