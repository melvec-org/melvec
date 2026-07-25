/**
 * Simple Map-based least recently used cache.
 *
 * Accessing an item promotes it to the most recently used position.
 * When the cache exceeds its maximum size, the oldest entry is evicted.
 */
class LRUCache {
    /**
     * @param {number} maxSize - Maximum number of entries to retain.
     */
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    /**
     * Returns a cached value and marks it as recently used.
     *
     * @param {*} key - Cache key.
     * @returns {*} Cached value or undefined when the key is not present.
     */
    get(key) {
        if (!this.cache.has(key)) return undefined;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    /**
     * Stores a value in the cache and evicts the least recently used item when full.
     *
     * @param {*} key - Cache key.
     * @param {*} value - Value to store.
     */
    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    /**
     * Removes a cached entry.
     *
     * @param {*} key - Cache key to delete.
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Removes all cached entries.
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Returns all cache keys in least-recently-used to most-recently-used order.
     *
     * @returns {Array<*>} Current cache keys.
     */
    getAllKeys() {
        return Array.from(this.cache.keys());
    }
}
//sample implementation
//const videoCache = new LRUCache(1000);
module.exports = LRUCache;
