import cloneDeep from './cloneDeep';

describe('cloneDeep', () => {
    test('returns primitive values as-is', () => {
        expect(cloneDeep('text')).toBe('text');
        expect(cloneDeep(42)).toBe(42);
        expect(cloneDeep(true)).toBe(true);
        expect(cloneDeep(null)).toBe(null);
        expect(cloneDeep(undefined)).toBe(undefined);
    });

    test('deep clones a nested object without preserving nested references', () => {
        const source = {
            id: 1,
            details: {
                title: 'Holiday',
                meta: {
                    rating: 5,
                },
            },
        };

        const result = cloneDeep(source);

        expect(result).toEqual(source);
        expect(result).not.toBe(source);
        expect(result.details).not.toBe(source.details);
        expect(result.details.meta).not.toBe(source.details.meta);
    });

    test('deep clones arrays and mixed object-array nesting', () => {
        const source = {
            tags: ['family', 'travel'],
            items: [{ id: 'one' }, { id: 'two', values: [1, 2, 3] }],
        };

        const result = cloneDeep(source);

        expect(result).toEqual(source);
        expect(result.tags).not.toBe(source.tags);
        expect(result.items).not.toBe(source.items);
        expect(result.items[0]).not.toBe(source.items[0]);
        expect(result.items[1].values).not.toBe(source.items[1].values);
    });

    test('mutating the clone does not mutate the original', () => {
        const source = {
            name: 'Original',
            nested: {
                count: 1,
            },
            list: [{ selected: false }],
        };

        const result = cloneDeep(source);
        result.name = 'Clone';
        result.nested.count = 2;
        result.list[0].selected = true;

        expect(source).toEqual({
            name: 'Original',
            nested: {
                count: 1,
            },
            list: [{ selected: false }],
        });
    });

    test('clones only own properties', () => {
        const inherited = { inherited: 'skip' };
        const source = Object.create(inherited);
        source.own = { value: 'keep' };

        const result = cloneDeep(source);

        expect(result).toEqual({ own: { value: 'keep' } });
        expect(result.inherited).toBeUndefined();
    });
});
