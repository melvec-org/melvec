const dirTree = require('directory-tree');
const { SUPPORTED_VIDEO_EXTENSIONS } = require('../../configs/systemConfig');

/**
 * Recursively scans a root folder for supported video files and tags each file with its parent collection name.
 *
 * Supported extensions are controlled by `SUPPORTED_VIDEO_EXTENSIONS` from the system config,
 * unless `config.extensions` is provided.
 *
 * @param {{rootFolder: string, attributes?: string[], exclude?: RegExp|Function|string[], extensions?: RegExp}} config - Scan configuration.
 * @returns {Array<Object>} Flattened list of discovered file descriptors.
 */
const scanMediaFiles = (config) => {
    const tree = dirTree(config.rootFolder, {
        extensions: config.extensions || SUPPORTED_VIDEO_EXTENSIONS,
        attributes: config.attributes,
        exclude: config.exclude,
    });

    if (tree !== null) {
        const getFilesAndCollections = (directory) => {
            let filesArray = [];

            const filterData = (directory) => {
                for (let i = 0; i < directory.children.length; i++) {
                    const item = directory.children[i];
                    const directoryName = directory.name;

                    if (item.type === 'directory') {
                        filterData(item);
                    } else {
                        item.coll = directoryName;
                        delete item.type;
                        filesArray.push(item);
                    }
                }
            };

            filterData(directory);
            return {
                filesArray,
            };
        };
        const fileTree = getFilesAndCollections(tree);

        return fileTree.filesArray;
    } else {
        return [];
    }
};

module.exports = scanMediaFiles;
