const { createReadStream } = require('fs');
const toBase62 = require('./toBase62');
const crypto = require('crypto');

/**
 * Generates a unique media ID based on the SHA-256 hash of the file content.
 * The function reads the file content in chunks using a stream,
 * hashes the content, and then encodes the first 64 bits (16 hex chars) to Base62 to shorten the hash
 *
 * This can work well for large files as it reads the file content in chunks.
 *
 * We can use this file id to uniquely identify each video file, as long as the file content doesn't change.
 *
 * This approach would work for a 1million videos dataset without significant probability of hash collisions ( 0.000271% ie 0.00000271)
 * and for 10k videos dataset without significant probability of hash collisions ( 0.000000000271)
 *
 * @param {string} filePath - The path to the video file.
 * @returns {Promise<string>} - A promise that resolves to the generated video ID.
 */
async function generateMediaId(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    // Stream the file content into the hash
    for await (const chunk of stream) {
        hash.update(chunk);
    }

    // Take first 64 bits (16 hex chars = 8 bytes)
    const shortHash = hash.digest('hex').slice(0, 16);

    // Convert hex to BigInt for Base62 encoding
    const hashInt = BigInt(`0x${shortHash}`);

    // Encode to Base62
    return toBase62(hashInt);
}

module.exports = generateMediaId;
