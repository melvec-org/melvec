const path = require('path');
const fse = require('fs-extra');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { getLibDir, getTrashBinPath } = require('../servicePathConfig');
const { removeFile } = require('../service-utils/fileUtils');
const { getRelativeMediaPath, getAbsoluteMediaPath } = require('../service-utils/mediaPath');
const { doesCollectionExists, addCollection } = require('../database/collectionsDbService');
const {
    initializeDb,
    checkForDuplicateAudio,
    addAudio,
    getAllAudioIds: getAllAudioIdsFromDb,
    getAudioDetailsById,
    updateAudioDetails,
    updateDescriptionAndEmbedding,
    getAudioDescriptionById,
    resetAudiosMetaData,
    deleteAudioFromDb,
} = require('../database/audioLibraryDbService');
const { getHiddenCollectionIds } = require('../collections/collections');
const mediaTypes = require('../../constants/mediaTypes');
const { getTagsByAudioId } = require('../database/tagsDbService');
const { MAX_SHORT_DESCRIPTION_LENGTH } = require('../../configs/appConfig');
const indexingEvents = require('../../events/indexingEvents');
const responseStatus = require('../../constants/responseStatus');

const updateAudioDetailsById = (id = '', udpatedDetails = {}) => {
    if (id !== '') {
        const audioData = getAudioDetailsById(id);
        if (audioData !== null) {
            updateAudioDetails({ ...audioData, ...udpatedDetails });
        }
    }
};

const getAllAudioIds = () => {
    return getAllAudioIdsFromDb() || [];
};

const getAudioFullPath = (audioPath = '') => {
    return path.join(getLibDir(), audioPath);
};

const getRelativeFolderPath = (mediaPath = '') => mediaPath.slice(0, mediaPath.lastIndexOf('/'));

const moveAudio = async (audioId = '', newCollection = {}) => {
    const audioDetails = getAudioDetailsById(audioId);

    if (!audioDetails) {
        return null;
    }

    const libraryDirectory = getLibDir();
    const fileName = audioDetails.path.split('/').pop();
    const newPath = path.join('' + newCollection.year, newCollection.label, fileName);

    const fullQualifiedDestPath = path.join(libraryDirectory, newPath);
    const sourceAudioPath = path.join(libraryDirectory, audioDetails.path);

    await fse.move(sourceAudioPath, fullQualifiedDestPath);

    const oldCollectionId = audioDetails.collection_id;
    const newCollectionId = newCollection.id;

    updateAudioDetailsById(audioId, {
        path: newPath,
        collection_id: newCollection.id,
    });

    serviceEventBus.publish(interServiceEvents.VIDEO_COLLECTION_CHANGE, {
        newCollectionId,
        oldCollectionId,
    });

    return getAudioDetailsById(audioId);
};

const deleteAudioDetails = async (audioId = '', initiator = 'user') => {
    if (!audioId) {
        return {
            status: responseStatus.ERROR,
            message: 'AudioId missing',
        };
    }

    const audioData = getAudioDetailsById(audioId);
    if (audioData === null) {
        return {
            status: responseStatus.ERROR,
            message: 'Audio details not found',
        };
    }

    if (initiator !== 'ENOENT') {
        const removeFileAction = await removeFile(getAudioFullPath(audioData.path), getTrashBinPath());

        if (removeFileAction.code && removeFileAction.code !== 'ENOENT') {
            throw new Error(`Error removing audio file: ${audioId}, error: ${removeFileAction.message}`);
        }

        serviceEventBus.publish(interServiceEvents.DELETE_AUDIO, { audioId });

        const deleteDbStatus = deleteAudioFromDb(audioId);

        if (!deleteDbStatus) {
            throw new Error(`Error deleting audio from DB: ${audioId}`);
        }
    } else {
        serviceEventBus.publish(interServiceEvents.DELETE_AUDIO, { audioId });

        // ENOENT — this audio was deleted from disk by another process,
        // so we just remove the DB record and trigger reindexing.
        const isDeleteSuccess = deleteAudioFromDb(audioId);

        if (!isDeleteSuccess) {
            return { status: responseStatus.FAILURE, audioId };
        }
    }

    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, { change: indexingEvents.AUDIO_DELETE, audioId });

    return { status: responseStatus.SUCCESS, audioId };
};

const importAudioFromWatchedDirectory = async (mediaDetails, destinationCollection) => {
    if (!mediaDetails?.id || !destinationCollection?.id) {
        throw new Error('mediaDetails or destination collection is not well defined');
    }

    const fileName = mediaDetails.name;
    const relativeAudioPath = getRelativeMediaPath(destinationCollection.year, destinationCollection.label, fileName, mediaDetails.id);

    const destinationAudioPath = getAbsoluteMediaPath(relativeAudioPath);
    const sourceAudioPath = mediaDetails.path;

    try {
        await fse.move(sourceAudioPath, destinationAudioPath);

        const newAudioStats = {
            id: mediaDetails.id,
            name: mediaDetails.name,
            birthtimeMs: mediaDetails.birthtimeMs,
            path: relativeAudioPath,
            coll: destinationCollection.label,
            collection_id: destinationCollection.id,
            year: destinationCollection.year,
            title: '',
            role: mediaDetails.role || mediaTypes.AUDIO,
            size: mediaDetails.size,
            duration: mediaDetails.duration ?? null,
            watchFolderId: mediaDetails.watchFolderId,
            mediaType: mediaTypes.AUDIO,
        };

        serviceEventBus.publish(interServiceEvents.IMPORT_FILE_SUCCESS, {
            completedMediaStats: newAudioStats,
            mediaType: mediaTypes.AUDIO,
        });

        return {
            status: responseStatus.SUCCESS,
            data: {
                audioDetails: newAudioStats,
            },
        };
    } catch (err) {
        serviceEventBus.publish(interServiceEvents.IMPORT_FILE_FAILURE, {
            audioDetails: mediaDetails,
            message: 'Failed to import audio',
            error: err,
        });

        throw {
            status: responseStatus.ERROR,
            data: {
                audioDetails: mediaDetails,
                error: err,
            },
        };
    }
};

const renameAudioFile = async (audioId = '', oldFileName = '', newFileName = '') => {
    if (audioId === '' || oldFileName === '' || newFileName === '') {
        return {
            status: responseStatus.ERROR,
            message: 'audioId, oldFileName and newFileName are required',
        };
    }

    const audioData = getAudioDetailsById(audioId);

    if (audioData === null) {
        return {
            status: responseStatus.ERROR,
            message: `Audio not found for id: ${audioId}`,
        };
    }

    if (audioData.name !== oldFileName) {
        return {
            status: responseStatus.ERROR,
            message: `Audio rename rejected because stored file name does not match ${oldFileName}`,
        };
    }

    const uniqueIDPrefix = `_${audioId}_`;
    const uniqueNewFileName = uniqueIDPrefix + newFileName;
    const absoluteExistingAudioFilePath = getAudioFullPath(audioData.path);
    const newPath = path.join(getRelativeFolderPath(audioData.path), uniqueNewFileName);
    const absoluteNewAudioFilePath = getAudioFullPath(newPath);

    try {
        await fse.move(absoluteExistingAudioFilePath, absoluteNewAudioFilePath);
        ((audioData.name = newFileName), (audioData.path = newPath), updateAudioDetails(audioData));
        return {
            status: responseStatus.SUCCESS,
            message: 'File name updated successfully',
        };
    } catch (error) {
        console.error(`Error renaming file for audioId: ${audioId}, error: ${error}`);
        return {
            status: responseStatus.ERROR,
            message: `Failed to rename audio file for ${audioId}`,
        };
    }
};

const updateAudioNsfwStatus = (audioId = '', isNsfw = false) => {
    if (audioId === '') {
        return null;
    }
    try {
        updateAudioDetailsById(audioId, {
            is_nsfw: isNsfw ? 1 : 0,
        });
        return {
            status: responseStatus.SUCCESS,
            data: getAudioDetailsById(audioId),
        };
    } catch (error) {
        return {
            status: responseStatus.ERROR,
            message: `Error updating NSFW status for audio: ${audioId}, error: ${error.message}`,
        };
    }
};

const updateAudioTitle = (id = '', title = '') => {
    if (id !== '') {
        const audioData = getAudioDetailsById(id);

        if (audioData !== null) {
            updateAudioDetails({ ...audioData, ...{ title: title } });
            serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
                mediaType: mediaTypes.AUDIO,
                change: indexingEvents.AUDIO_TITLE_CHANGE,
                mediaId: id,
            });
            return _getAudioDetailsById(id);
        }
    }

    return null;
};

const onImportFileSuccess = (data) => {
    if (data.mediaType !== mediaTypes.AUDIO) return;

    const mediaStats = Object.assign({}, data.completedMediaStats);

    const collectionExists = doesCollectionExists(mediaStats.collection_id);

    if (!collectionExists) {
        addCollection(mediaStats.collection_id, mediaStats.coll, mediaStats.year);
    }

    const doesAudioExist = checkForDuplicateAudio(mediaStats.id);
    if (doesAudioExist) {
        console.warn(`Skipping duplicate audio on import: ${mediaStats.id} (${mediaStats.name})`);
        return;
    }

    try {
        addAudio(mediaStats);
    } catch (err) {
        if (err.message?.includes('Duplicate ID')) {
            console.warn(`Skipping duplicate audio on import: ${mediaStats.id} (${mediaStats.name})`);
        } else {
            console.error(`Failed to import audio ${mediaStats.id} (${mediaStats.name}): ${err.message}`);
            throw err;
        }
    }
};

const _getAudioDetailsById = (audioId = '') => {
    if (audioId === undefined) {
        throw new Error('Invalid audioId', audioId);
    }
    let audioDetails = getAudioDetailsById(audioId);

    const hiddenCollections = getHiddenCollectionIds();

    if (audioDetails !== null) {
        return {
            id: audioDetails.id,
            name: audioDetails.name,
            role: audioDetails.role,
            collection: audioDetails.coll,
            collectionId: audioDetails.collection_id,
            path: audioDetails.path,
            size: audioDetails.size,
            birthtimeMs: audioDetails.birthtimeMs,
            title: audioDetails.title,
            duration: audioDetails.duration,
            isHidden: hiddenCollections.has(audioDetails.collection_id),
            isNsfw: audioDetails.is_nsfw,
            source: audioDetails.source,
            mediaType: mediaTypes.AUDIO,
        };
    } else {
        console.error('null data is persisting, clean call please', audioId);
        return null;
    }
};

const getFullAudioDetailsById = (audioId = '') => {
    const audioDetails = _getAudioDetailsById(audioId);

    if (!audioDetails) {
        return null;
    }

    const tags = getTagsByAudioId(audioId);
    const description = getAudioDescriptionById(audioId);

    const shortDesc = description ? description.slice(0, MAX_SHORT_DESCRIPTION_LENGTH) : '';

    return {
        ...audioDetails,
        tags,
        shortDesc,
    };
};

const updateAudioMetaData = (id, description = '', embedding = '') => {
    try {
        updateDescriptionAndEmbedding(id, description, embedding);
        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
            mediaType: mediaTypes.AUDIO,
            change: indexingEvents.AUDIO_META_DATA_CHANGE,
            mediaId: id,
        });
        return true;
    } catch (error) {
        return false;
    }
};

const initAudioLibraryService = () => {
    initializeDb();
    serviceEventBus.subscribe(interServiceEvents.IMPORT_FILE_SUCCESS, (data) => onImportFileSuccess(data));
};

module.exports = {
    initAudioLibraryService,
    getBasicAudioDetailsById: _getAudioDetailsById,
    getFullAudioDetailsById,
    getAllAudioIds,
    addAudio,
    updateAudioDetailsById,
    updateAudioTitle,
    updateAudioNsfwStatus,
    deleteAudioDetails,
    moveAudio,
    renameAudioFile,
    importAudioFromWatchedDirectory,
    updateAudioMetaData,
    resetAudiosMetaData,
};
