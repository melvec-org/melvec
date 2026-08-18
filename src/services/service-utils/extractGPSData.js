const { runCmdCapture } = require('./process');
const { getFfprobePath } = require('./binaryPaths');
const mediaTypes = require('../../constants/mediaTypes');
const exifr = require('exifr');

const parseCoordinate = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const numeric = Number.parseFloat(value);

    return Number.isFinite(numeric) ? numeric : null;
};

const applyDirection = (value, ref) => {
    if (!Number.isFinite(value)) return null;

    if (ref === 'S' || ref === 'W') {
        return -Math.abs(value);
    }

    return Math.abs(value);
};

const parseExifCoordinate = (value, ref) => {
    if (!value) return null;

    const decimal = parseCoordinate(value);

    if (decimal !== null && !String(value).includes(',')) {
        return applyDirection(decimal, ref);
    }

    const parts = String(value)
        .split(',')
        .map((part) => {
            const [numerator, denominator] = part.trim().split('/');

            const n = Number(numerator);
            const d = denominator ? Number(denominator) : 1;

            if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) {
                return null;
            }

            return n / d;
        });

    if (parts.length !== 3 || parts.some((part) => part === null)) {
        return null;
    }

    const [degrees, minutes, seconds] = parts;

    const coordinate = degrees + minutes / 60 + seconds / 3600;

    return applyDirection(coordinate, ref);
};

const extractCoordsFromTags = (tags = {}) => {
    const iso6709 = tags.comapplequicktimelocationiso6709 || tags['com.apple.quicktime.location.ISO6709'] || tags.location;

    if (typeof iso6709 === 'string') {
        const match = iso6709.match(/([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/);

        if (match) {
            const latitude = parseCoordinate(match[1]);
            const longitude = parseCoordinate(match[2]);

            if (latitude !== null && longitude !== null) {
                return { latitude, longitude };
            }
        }
    }

    const latitude = parseCoordinate(tags.location_latitude);
    const longitude = parseCoordinate(tags.location_longitude);

    if (latitude !== null && longitude !== null) {
        return { latitude, longitude };
    }

    const latitudeExif = parseExifCoordinate(tags.GPSLatitude, tags.GPSLatitudeRef);
    const longitudeExif = parseExifCoordinate(tags.GPSLongitude, tags.GPSLongitudeRef);

    if (latitudeExif !== null && longitudeExif !== null) {
        return {
            latitude: latitudeExif,
            longitude: longitudeExif,
        };
    }

    return null;
};

const extractGPSData = async (mediaPath, mediaType) => {
    if (![mediaTypes.VIDEO, mediaTypes.IMAGE].includes(mediaType)) {
        return null;
    }

    if (mediaType === mediaTypes.VIDEO) {
        const ffProbePath = getFfprobePath();

        const args = ['-v', 'error', '-show_entries', 'format_tags:stream_tags', '-of', 'json', mediaPath];

        const { stdout } = await runCmdCapture(ffProbePath, args);

        if (!stdout) {
            return null;
        }

        const probeData = JSON.parse(stdout);

        const sources = [probeData?.format?.tags, ...(probeData?.streams || []).map((stream) => stream?.tags)].filter(Boolean);

        for (const tags of sources) {
            const coords = extractCoordsFromTags(tags);

            if (coords) {
                return coords;
            }
        }
        return null;
    }
    if (mediaType === mediaTypes.IMAGE) {
        const gpsData = await exifr.parse(mediaPath, ['GPSLatitude', 'GPSLongitude']);
        return gpsData;
    }
};

module.exports = {
    extractGPSData,
};
