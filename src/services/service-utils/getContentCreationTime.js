const mediaTypes = require('../../constants/mediaTypes');
const exifr = require('exifr');

const { runCmdCapture } = require('./process');
const { getFfprobePath } = require('./binaryPaths');

const toUnixTimestamp = (value) => {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);
    const timestamp = date.getTime();

    return Number.isNaN(timestamp) ? null : Math.floor(timestamp);
};

const getVideoCreationTime = async (filePath) => {
    const ffprobePath = getFfprobePath();

    try {
        const { stdout } = await runCmdCapture(ffprobePath, [
            '-v',
            'error',
            '-show_entries',
            'format_tags=creation_time',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            filePath,
        ]);

        return toUnixTimestamp(String(stdout).trim());
    } catch (_) {
        return null;
    }
};

const getContentCreationTime = async (path, mediaType) => {
    if (mediaType === mediaTypes.IMAGE) {
        const exif = await exifr.parse(path, ['DateTimeOriginal']);

        return toUnixTimestamp(exif?.DateTimeOriginal);
    }

    if (mediaType === mediaTypes.VIDEO) {
        return getVideoCreationTime(path);
    }

    return null;
};

module.exports = {
    getContentCreationTime,
};
