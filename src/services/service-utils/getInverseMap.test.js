const getInverseMap = require('./getInverseMap');

describe('getInverseMap', () => {
    test('inverts object arrays into a reverse lookup map', () => {
        const result = getInverseMap({
            a: ['x'],
            b: ['x', 'y'],
            c: ['z'],
        });

        expect(Array.from(result.entries())).toEqual([
            ['x', ['a', 'b']],
            ['y', ['b']],
            ['z', ['c']],
        ]);
    });

    test('returns an empty map for an empty source object', () => {
        const result = getInverseMap({});

        expect(result).toBeInstanceOf(Map);
        expect(Array.from(result.entries())).toEqual([]);
    });

    test('groups duplicate values under the same key in encounter order', () => {
        const result = getInverseMap({
            photos: ['shared', 'private'],
            videos: ['shared'],
            docs: ['private'],
        });

        expect(result.get('shared')).toEqual(['photos', 'videos']);
        expect(result.get('private')).toEqual(['photos', 'docs']);
    });
});
