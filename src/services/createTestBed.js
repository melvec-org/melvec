const fse = require('fs-extra');
const { getDbPath, dbFileNames } = require('../services/servicePathConfig');
const { writeJSONFile } = require('./service-utils/fileUtils');

const deleteExistingFiles = (librararyPath = '') => {
    try {
        fse.removeSync(librararyPath);
    } catch (e) {
        return false;
    }
};

const copyNewFileSet = (libraryPath = '', libraryDumpPath = '') => {
    try {
        fse.copySync(libraryDumpPath, libraryPath);
    } catch (e) {
        return false;
    }
};

/**
 * The video libraries here are for testing purpose
 * @returns {boolean}
 */
const createInitialTestBed = () => {
    const currentLibrary = '/Volumes/data/video-library';
    const libraryDumpPath = '/Volumes/data/video-library-dump';
    deleteExistingFiles(currentLibrary);
    copyNewFileSet(currentLibrary, libraryDumpPath);
    return true;
};

const resetTagsData = (librararyPath) => {
    const tagsDbPath = getDbPath(dbFileNames.TAGS, librararyPath);

    const defaultFileContent = {
        lastUsedTags: [],
        list: [],
        hash: {},
    };

    if (tagsDbPath !== '') {
        writeJSONFile(tagsDbPath, defaultFileContent);
    }
};

module.exports = {
    createInitialTestBed,
    deleteExistingFiles,
    copyNewFileSet,
    resetTagsData,
};
