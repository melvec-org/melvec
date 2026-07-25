const LRUCache = require('./LRUCache');

describe('LRUCache', () => {
    test('stores values and returns undefined for missing keys', () => {
        const cache = new LRUCache(2);

        cache.set('a', 1);

        expect(cache.get('a')).toBe(1);
        expect(cache.get('missing')).toBeUndefined();
    });

    test('promotes accessed entries to most recently used order', () => {
        const cache = new LRUCache(3);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        cache.get('a');

        expect(cache.getAllKeys()).toEqual(['b', 'c', 'a']);
    });

    test('evicts the least recently used item when capacity is exceeded', () => {
        const cache = new LRUCache(2);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.get('a');
        cache.set('c', 3);

        expect(cache.get('b')).toBeUndefined();
        expect(cache.getAllKeys()).toEqual(['a', 'c']);
    });

    test('deletes and clears entries', () => {
        const cache = new LRUCache(3);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.delete('a');
        expect(cache.getAllKeys()).toEqual(['b']);

        cache.clear();
        expect(cache.getAllKeys()).toEqual([]);
    });
});
