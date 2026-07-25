/**
 * file names should be 256 chars or less
 * it should not contain \ / : * ? \" < > |
 * @param fileName
 */
const validateFileName = (fileName = '') => {
    const extension = fileName.split('.')[1];
    const fileNameWExtension = fileName.split('.')[0];

    if (fileNameWExtension.length > 256) {
        return fileNameWExtension.slice(0, 256) + '.' + extension;
    }

    return fileName;
};

module.exports = validateFileName;
