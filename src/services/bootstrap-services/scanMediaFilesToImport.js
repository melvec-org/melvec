const servicePathConfig = require('../servicePathConfig');
const systemConfig = require('../../configs/systemConfig');
const { writeJSONFile, readJSONFile } = require('../service-utils/fileUtils');
const scanMediaFiles = require('../service-utils/scanMediaFiles');
const getMediaTypeFromPath = require('../service-utils/getMediaTypeFromPath');

const getMediaUniqueKey = (item) => {
    return item.path;
};

const addMediaType = (item = {}) => {
    return {
        ...item,
        mediaType: getMediaTypeFromPath(item.path),
    };
};

/**
 * First it will check for media json data
 */
const scanMediaFilesToImport = () => {
    let excludeDirList = [];
    excludeDirList.push(new RegExp(systemConfig.PRIVATE_DIR));
    excludeDirList.push(new RegExp(systemConfig.LIBRARY_DIR));
    excludeDirList.push(new RegExp(systemConfig.THUMBNAILS_DIR));
    excludeDirList.push(new RegExp(systemConfig.PREVIEW_DIR));
    excludeDirList.push(new RegExp(systemConfig.TRASHBIN_DIR));
    excludeDirList.push(/.DS_Store/);

    const freshUnImportedFilesList = scanMediaFiles({
        rootFolder: servicePathConfig.getLibraryRootPath(),
        attributes: ['birthtimeMs', 'type', 'size'],
        exclude: excludeDirList,
        extensions: systemConfig.SUPPORTED_MEDIA_EXTENSIONS,
    }).map(addMediaType);

    let existingNonImportedFilesList = readJSONFile(servicePathConfig.getNonImportedLibraryDb(), []);
    existingNonImportedFilesList = existingNonImportedFilesList.filter((item) => item.importError === undefined).map(addMediaType);

    const mergedMap = new Map();

    [...existingNonImportedFilesList, ...freshUnImportedFilesList].forEach((item) => {
        const mediaItem = addMediaType(item);
        const key = getMediaUniqueKey(mediaItem);

        if (!key) {
            return;
        }

        if (!mergedMap.has(key)) {
            mergedMap.set(key, mediaItem);
            return;
        }

        const existingItem = mergedMap.get(key);
        mergedMap.set(key, {
            ...existingItem,
            ...mediaItem,
        });
    });

    const allNonImportedFilesList = Array.from(mergedMap.values());
    writeJSONFile(servicePathConfig.getNonImportedLibraryDb(), allNonImportedFilesList);

    return allNonImportedFilesList;
};

module.exports = {
    scanMediaFilesToImport,
};
