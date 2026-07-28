const fs = require('fs');
const fse = require('fs-extra');
const fsPromises = require('fs').promises;
const path = require('path');

/**
 * use this only when the file may or may not exist.
 * @param filePath
 * @param defaults this is returned if anu error occurs
 * @returns {{}|any}
 */
const readJSONFile = (filePath, defaults) => {
    try {
        let strData = fs.readFileSync(filePath, 'utf-8');
        if (strData === '') {
            strData = `{}`;
        }
        return JSON.parse(strData);
    } catch (error) {
        if (defaults) return defaults;
        else {
            console.error('some error happened in reading', filePath);
            return null;
        }
    }
};

/**
 * saves a a file, but in async mode
 * @param path
 * @param data
 */
const writeJSONFile = (path, data = null) => {
    if (data === null) {
        throw new Error(`JSON file data is null for : ${path}`);
    }

    fse.ensureFileSync(path);

    fse.writeJson(path, data)
        .then(() => {
            return Promise.resolve();
        })
        .catch((err) => {
            return Promise.reject(err);
        });
};

/**
 * writes a file in the path, it would create a directory if does not exist
 * @param path
 * @param contents
 * @param cb
 */
const writeFile = async (path, contents) => {
    return fse.outputFile(path, contents).then(() => {
        return new Promise((resolve) => {
            resolve(path);
        });
    });
};

/**
 * checks if file exist or not.
 */
const doesFileExist = (path) => fs.existsSync(path);

const doesDirectoryExist = (path) => fs.existsSync(path);

const doesFileExistAsync = async (filePath) => {
    try {
        await fs.promises.access(filePath, fs.constants.R_OK);
        return true;
    } catch (e) {
        return false;
    }
};

/**
 *  checks if the file exists.
 *  If it does, it just calls back.
 *  If it doesn't, then the file is created.
 * this uses the writeFile method to properly create the files
 */
const checkAndCreateJsonFileSync = (fileName, fallbackContent, callBack) => {
    if (doesFileExist(fileName)) {
        return fse.readJsonSync(fileName);
    } else {
        const content = JSON.stringify(fallbackContent);
        fse.outputFileSync(fileName, content);
        return fallbackContent;
    }
};

/**
 * Recursively removes empty directories from the given directory.
 * If the directory itself is empty, it is also removed.
 * Code taken from: https://gist.github.com/jakub-g/5903dc7e4028133704a4
 * @param {string} directory Path to the directory to clean up
 */
const removeEmptyDirectories = async (directory) => {
    // lstat does not follow symlinks (in contrast to stat)
    const fileStats = await fsPromises.lstat(directory);
    if (!fileStats.isDirectory()) {
        return;
    }
    let fileNames = await fsPromises.readdir(directory);

    if (fileNames.length > 0) {
        const recursiveRemovalPromises = fileNames.map((fileName) => removeEmptyDirectories(path.join(directory, fileName)));
        await Promise.all(recursiveRemovalPromises);

        // re-evaluate fileNames; after deleting subdirectory
        // we may have parent directory empty now
        fileNames = await fsPromises.readdir(directory);
    }
    if (fileNames.length === 0) {
        await fsPromises.rmdir(directory);
    }
};
/**
 * get all directory names in a given folder
 * @param source
 */
const getDirectories = async (source) =>
    (await fsPromises.readdir(source, { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);

/**
 * Removes a file:
 * - If a trashbinPath is provided, moves the file to the trash folder (safe delete)
 * - Otherwise, permanently removes the file from disk
 *
 * @param {string} filePath - Absolute path to the file to remove
 * @param {string} [trashbinPath] - Optional trash folder location
 * @returns {Promise<{status: string, message: string, from: string, to?: string}>}
 */
const removeFile = async (filePath = '', trashbinPath = '') => {
    try {
        if (!filePath) {
            throw new Error('File path is empty.');
        }

        // If no trashbinPath, permanently remove file
        if (!trashbinPath) {
            await fsPromises.rm(filePath);
            return {
                status: 'success',
                message: 'File permanently removed.',
                from: filePath,
            };
        }

        // Otherwise: move the file to the provided trashbin folder
        const fileName = path.basename(filePath);
        const targetTrashDir = trashbinPath;

        await fse.ensureDir(targetTrashDir);

        let destinationPath = path.join(targetTrashDir, fileName);

        // Handle name collisions
        if (await fse.pathExists(destinationPath)) {
            const timeStamp = Date.now();
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            destinationPath = path.join(targetTrashDir, `${base}_${timeStamp}${ext}`);
        }

        await fse.move(filePath, destinationPath, { overwrite: false });

        return {
            status: 'success',
            message: 'File moved to trash.',
            from: filePath,
            to: destinationPath,
        };
    } catch (err) {
        return {
            status: 'failure',
            message: err.message,
            code: err.code,
            from: filePath,
            to: trashbinPath || '',
        };
    }
};

const renameDirectory = async (oldPath, newPath) => {
    try {
        await fse.rename(oldPath, newPath);
    } catch (err) {
        console.error(`Error renaming directory: ${err.message}`);
    }
};

/**
 * Recursively calculate folder size in bytes using fs-extra (async)
 */
const getFolderSizeBytes = async (folderPath) => {
    let totalSize = 0;
    try {
        const items = await fse.readdir(folderPath);
        for (const item of items) {
            const fullPath = path.join(folderPath, item);
            const stats = await fse.stat(fullPath); // fs-extra stat
            if (stats.isDirectory()) {
                totalSize += await getFolderSizeBytes(fullPath); // recursion
            } else {
                totalSize += stats.size;
            }
        }
    } catch (err) {
        console.error(`Error reading ${folderPath}: ${err.message}`);
    }
    return totalSize;
};

const getFolderSize = async (folderPath) => {
    const librarySizeBytes = await getFolderSizeBytes(folderPath);
    const librarySizeMB = (librarySizeBytes / (1024 * 1024)).toFixed(2);
    if (librarySizeMB > 1024) {
        return (librarySizeMB / 1024).toFixed(2) + ' GB';
    } else {
        return librarySizeMB + ' MB';
    }
};

module.exports = {
    readJSONFile,
    writeJSONFile,
    doesFileExist,
    doesFileExistAsync,
    checkAndCreateJsonFileSync,
    removeEmptyDirectories,
    getDirectories,
    writeFile,
    removeFile,
    doesDirectoryExist,
    renameDirectory,
    getFolderSize,
    ensureDir: fse.ensureDirSync,
};
