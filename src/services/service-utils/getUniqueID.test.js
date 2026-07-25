const getUniqueID = require('./getUniqueID');

describe('getUniqueID', () => {
    test('returns a non-empty string id', () => {
        const id = getUniqueID();

        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    test('returns different ids across repeated calls', () => {
        const first = getUniqueID();
        const second = getUniqueID();

        expect(first).not.toBe(second);
    });
});
