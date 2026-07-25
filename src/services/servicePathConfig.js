const path = require('path');

const systemConfig = require('../configs/systemConfig');
const { electron } = require('process');
let libraryRootPath = '';

const setLibraryRootPath = (path) => {
    libraryRootPath = path;
};

const getLibraryRootPath = () => {
    return libraryRootPath;
};

const dbFileNames = {
    // application settings file
    APPLICATION_SETTINGS: 'application-settings.json',
    // all playlist cached file, that contains all vi
    PLAYLISTS: 'playlists.json',

    NON_IMPORTED_LIBRARY_VIDEOS: 'non-imported-library-videos.json',
    VIDEO_LIBRARY: 'video-library.db',

    ACTION_HISTORY: 'action-history.json',

    // application status log file, kept for future use
    APPLICATION_LOG: 'application-log.json',
};

const getDbPath = (databaseName = '', libPath = '') => {
    const libraryPath = libPath !== '' ? libPath : libraryRootPath;
    return path.join(libraryPath, systemConfig.PRIVATE_DIR, databaseName);
};

const getConfigDirectory = (libraryRootPath = libraryRootPath) => path.join(libraryRootPath, systemConfig.PRIVATE_DIR);

const getThumbnailsDir = () => path.join(libraryRootPath, '._th_');

const getPreviewDir = () => path.join(libraryRootPath, '._pvw_');

const getLibDir = () => {
    return path.join(libraryRootPath, '_lib_');
};

const getNonImportedLibraryDb = () => getDbPath(dbFileNames.NON_IMPORTED_LIBRARY_VIDEOS, libraryRootPath);

const getLibraryErrorLogFilePath = () => path.join(libraryRootPath, 'errors.log');

const getTrashBinPath = () => path.join(getLibraryRootPath(), systemConfig.TRASHBIN_DIR);

module.exports = {
    dbFileNames,
    setLibraryRootPath,
    getLibraryRootPath,
    getDbPath,
    getConfigDirectory,
    getThumbnailsDir,
    getPreviewDir,
    getLibDir,
    getNonImportedLibraryDb,
    getLibraryErrorLogFilePath,
    getTrashBinPath,
};
