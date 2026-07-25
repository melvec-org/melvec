const systemConfig = require('../../configs/systemConfig');

/**
 * Extracts the calendar year from a timestamp in milliseconds.
 *
 * @param {number} timeInMS - Timestamp in milliseconds.
 * @returns {number} Year component.
 */
const getYearFromTime = (timeInMS) => {
    const date = new Date(timeInMS);
    return date.getFullYear();
};

/**
 * Returns the file year or a configured fallback collection year when unavailable.
 *
 * @param {number} birthtimeMs - File birth time in milliseconds.
 * @returns {number|string} File year or configured default.
 */
const getFileYear = (birthtimeMs) =>
    birthtimeMs ? getYearFromTime(birthtimeMs) : systemConfig.DEFAULT_COLLECTION_YEAR;

module.exports = {
    getYearFromTime,
    getFileYear,
};
