const toBase62 = require('./toBase62');

let counter = 0;
const epoch = 1740000000000; // Custom epoch: Jan 1, 2023

/**
 * Generates a compact monotonically increasing identifier encoded in Base62.
 *
 * The identifier combines a custom-epoch timestamp with an in-process counter.
 *
 * @returns {string} Generated identifier.
 */
const getUniqueID = () => {
    const ts = Date.now() - epoch; // Milliseconds since epoch
    const salt = parseInt(Math.random() * 999); // unique id would make more randomization
    if (counter > 9999) counter = 0; // Reset counter if exceeds 9999
    const raw = BigInt(ts) * 10000n + BigInt(counter++); // Combine timestamp and counter
    return toBase62(raw); // Convert to Base62
};

/**
 * Old implementation
 *
 * The logic is two fold.
 * First part creates a double/tripple alpha numeric string
 * which combine to give the unique possibility if the function is being called multiple times even in a loop.
 *
 * And second part creates a relatively long 5-6 letter string that may be constant if the function is called multiple times
 * in a cpu cycle.
 *
 * Note 01: The radix is changed to 36 to make the string relatively small
 * Note 02: In the secondpart we are substracting 1600000000000 to make the second numeric data
 * to be relatively small after to string conversion
 * @returns
 */
//const getUniqueID = () => `${parseInt(Math.random() * 999).toString(36)}-${(Date.now() - 1600000000000).toString(36)}`;

module.exports = getUniqueID;
