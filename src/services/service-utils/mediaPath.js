const path = require('path');
const { getLibDir } = require('../servicePathConfig');
const { DEFAULT_COLLECTION_NAME, DEFAULT_COLLECTION_YEAR } = require('../../configs/systemConfig');

/**
 * Builds the library-relative storage path for a video file.
 *
 * @param {string|number} year - Collection year segment.
 * @param {string} collecionName - Collection folder name.
 * @param {string} filename - Original video file name.
 * @param {string} id - Video identifier.
 * @returns {string} Relative library path.
 */
const getRelativeMediaPath = (year, collecionName, filename, id) => {
    if (collecionName !== DEFAULT_COLLECTION_NAME) {
        return path.join('' + year, collecionName, `_${id}_` + filename);
    } else {
        return path.join(DEFAULT_COLLECTION_YEAR.toString(), collecionName, `_${id}_` + filename);
    }
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
