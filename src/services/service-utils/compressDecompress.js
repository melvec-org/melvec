/**
 * Compresses a JSON-compatible value by replacing repeated keys and primitive values
 * with short references and storing the lookup tables alongside the transformed data.
 *
 * @param {*} jsonObj - JSON-compatible object, array, or primitive to compress.
 * @returns {{refs: {keys: Array<[string, string]>, values: Array<[string, *]>}, data: *}} Compressed payload and reference tables.
 */
function compressJSON(jsonObj) {
    const keyRef = new Map(); // Maps keys to hashes
    const valueRef = new Map(); // Maps values to hashes
    let keyCounter = 0;
    let valueCounter = 0;

    // Helper to generate short hashes
    const getHash = (type, counter) => `${type}${counter}`;

    // Helper to process values (strings, numbers, booleans, null)
    const processValue = (val) => {
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
            const valStr = JSON.stringify(val); // Use JSON string for consistent lookup
            if (!valueRef.has(valStr)) {
                valueRef.set(valStr, getHash('v', valueCounter++));
            }
            return valueRef.get(valStr);
        }
        return val;
    };

    // Recursive function to compress the JSON
    const compress = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map((item) => compress(item));
        } else if (obj && typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                // Compress key
                if (!keyRef.has(key)) {
                    keyRef.set(key, getHash('k', keyCounter++));
                }
                const newKey = keyRef.get(key);
                // Compress value
                result[newKey] = compress(obj[key]);
            }
            return result;
        } else {
            return processValue(obj);
        }
    };

    // Build the compressed structure
    const compressed = {
        refs: {
            keys: [...keyRef.entries()].map(([key, hash]) => [hash, key]),
            values: [...valueRef.entries()].map(([val, hash]) => [hash, JSON.parse(val)]),
        },
        data: compress(jsonObj),
    };

    return compressed;
}

/**
 * Restores a value previously created by compressJSON back to its original structure.
 *
 * @param {{refs: {keys: Array<[string, string]>, values: Array<[string, *]>}, data: *}} compressedObj - Compressed object with key and value references.
 * @returns {*} Decompressed JSON-compatible value.
 */
function decompressJSON(compressedObj) {
    const { refs, data } = compressedObj;
    const keyMap = new Map(refs.keys); // Hash -> original key
    const valueMap = new Map(refs.values); // Hash -> original value

    // Recursive function to decompress
    const decompress = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map((item) => decompress(item));
        } else if (obj && typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                const originalKey = keyMap.get(key) || key;
                result[originalKey] = decompress(obj[key]);
            }
            return result;
        } else if (typeof obj === 'string' && valueMap.has(obj)) {
            return valueMap.get(obj);
        }
        return obj;
    };

    return decompress(data);
}

module.exports = { compressJSON, decompressJSON };
