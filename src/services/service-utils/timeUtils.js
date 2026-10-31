const systemConfig = require('../../configs/systemConfig');

const DEFAULT_FUTURE_TIME_TOLERANCE_MS = 0;

const toTimestamp = (timeInMS) => {
    if (timeInMS === null || timeInMS === undefined || timeInMS === '') {
        return null;
    }

    const timestamp = Number(timeInMS);
    return Number.isFinite(timestamp) ? timestamp : null;
};

/**
 * Checks whether a timestamp is safe to use as a media date.
 *
 * A valid media timestamp must be numeric, finite, positive, parseable by Date,
 * and not in the future. Future timestamps are treated as unknown dates so they
 * route to the system default collection year.
 *
 * @param {number|string} timeInMS - Timestamp in milliseconds.
 * @param {number} futureToleranceMs - Allowed future clock skew in milliseconds.
 * @returns {boolean} True when the timestamp can be used for year calculation.
 */
const isValidMediaTimestamp = (timeInMS, futureToleranceMs = DEFAULT_FUTURE_TIME_TOLERANCE_MS) => {
    const timestamp = toTimestamp(timeInMS);
    if (timestamp === null || timestamp <= 0) {
        return false;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return false;
    }

    return timestamp <= Date.now() + futureToleranceMs;
};

/**
 * Picks the first valid media timestamp from a list of candidates.
 *
 * Use this when choosing between embedded content creation time and filesystem
 * birth time. Invalid or future candidates are skipped instead of overriding a
 * later valid fallback timestamp.
 *
 * @param {...(number|string|null|undefined)} timestamps - Candidate timestamps in priority order.
 * @returns {number|null} First valid timestamp, or null when none are valid.
 */
const getPreferredMediaTimestamp = (...timestamps) => {
    for (const timeInMS of timestamps) {
        const timestamp = toTimestamp(timeInMS);
        if (isValidMediaTimestamp(timestamp)) {
            return timestamp;
        }
    }

    return null;
};

/**
 * Extracts the calendar year from a timestamp in milliseconds.
 *
 * Invalid, missing, or future timestamps return the configured system default
 * collection year.
 *
 * @param {number|string} timeInMS - Timestamp in milliseconds.
 * @returns {number} Year component or configured default year.
 */
const getYearFromTime = (timeInMS) => {
    if (!isValidMediaTimestamp(timeInMS)) {
        return systemConfig.DEFAULT_COLLECTION_YEAR;
    }

    const date = new Date(Number(timeInMS));
    return date.getFullYear();
};

/**
 * Returns the file year or a configured fallback collection year when unavailable.
 *
 * @param {number|string} birthtimeMs - File birth time in milliseconds.
 * @returns {number} File year or configured default year.
 */
const getFileYear = (birthtimeMs) => getYearFromTime(birthtimeMs);

module.exports = {
    isValidMediaTimestamp,
    getPreferredMediaTimestamp,
    getYearFromTime,
    getFileYear,
};
