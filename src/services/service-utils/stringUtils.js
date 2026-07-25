/**
 * converts underscore values to spaces in a file name
 * @param {*} fileName
 */
const createDescFromFileName = (fileName) => {
    if (fileName.length < 24 || fileName.startsWith('vid')) return '';
    return fileName.replace(/_|\.mp4/g, ' ');
};

/**
 * removes all unwanted html tags if added as part of editing process
 * @param {*} fileName
 */
const sanitizeFileName = (fileName) => fileName.replace(/<div>|<\/div>|<br>|&nbsp;/g, '');

module.exports = {
    createDescFromFileName,
    sanitizeFileName,
};
