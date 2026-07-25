/**
 * Performs a deep equality comparison for primitives, arrays, and plain objects.
 *
 * @param {*} a - First value to compare.
 * @param {*} b - Second value to compare.
 * @returns {boolean} True when the values are structurally equal.
 */
function deepEqual(a, b) {
    // Strict equality check for primitives
    if (a === b) return true;

    // Check types — must match
    if (typeof a !== typeof b) return false;

    // Handle null values
    if (a === null || b === null) return false;

    // Handle Arrays
    if (Array.isArray(a)) {
        if (!Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    // Handle Objects
    if (typeof a === 'object') {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
            if (!deepEqual(a[key], b[key])) return false;
        }
        return true;
    }

    // Fallback for other types (will cover NaN correctly)
    return a !== a && b !== b; // handles NaN case
}

module.exports = deepEqual;
