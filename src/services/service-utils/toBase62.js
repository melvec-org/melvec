const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Encodes a non-negative BigInt into a Base62 string.
 *
 * @param {bigint} num - Number to encode.
 * @returns {string} Base62-encoded representation.
 */
function toBase62(num) {
    let result = '';
    while (num > 0n) {
        result = BASE62[Number(num % 62n)] + result; // Use 62n for BigInt
        num = num / 62n; // Use 62n for BigInt
    }
    return result || '0';
}

module.exports = toBase62;
