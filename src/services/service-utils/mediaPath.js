const path = require('path');
const { getLibDir } = require('../servicePathConfig');

/**
 * Builds the library-relative storage path for a media file.
 *
 * The collection year is the source of truth for the year segment. Do not
 * special-case by collection label: legacy media may exist in year-scoped
 * collections named "Default collection", and the system default collection
 * already carries year 10000 in its collection row.
 *
 * @param {string|number} year - Collection year segment.
 * @param {string} collecionName - Collection folder name.
 * @param {string} filename - Original media file name.
 * @param {string} id - Media identifier.
 * @returns {string} Relative library path.
 */
const getRelativeMediaPath = (year, collecionName, filename, id) => {
    return path.join(String(year), collecionName, `_${id}_` + filename);
};

/**
 * Resolves a library-relative video path to an absolute filesystem path.
 *
 * @param {string} relativePath - Relative library path.
 * @returns {string} Absolute filesystem path.
 */
const getAbsoluteMediaPath = (relativePath) => {
    const finalPath = path.join(getLibDir(), relativePath);
    return finalPath;
};

module.exports = {
    getRelativeMediaPath,
    getAbsoluteMediaPath,
};
