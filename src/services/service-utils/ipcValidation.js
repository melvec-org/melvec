const path = require('path');
const fs = require('fs');
const mediaTypes = require('../../constants/mediaTypes');
const { respondError } = require('./sendToUI');

const USER_PREFERENCE_VALIDATORS = {
    theme: (value) => ['light', 'dark', 'system'].includes(value),
    hideHiddenCollections: (value) => typeof value === 'boolean',
    playlistAutoPlay: (value) => typeof value === 'boolean',
    transparentWindowMode: (value) => typeof value === 'boolean',
    hideNsfwContent: (value) => typeof value === 'boolean',
    showVideoPreviewOnHover: (value) => typeof value === 'boolean',
    isAIEnabled: (value) => typeof value === 'boolean',
    lastUsedLibraryPaths: (value) => Array.isArray(value) && value.every((item) => typeof item === 'string'),
    viewPreference: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    ai: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
};

const APPLICATION_SETTINGS_VALIDATORS = {
    currentApplicationView: (value) => typeof value === 'string' && value.trim() !== '',
    lastBrowserState: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    browserVideoListViewType: (value) => typeof value === 'string' && value.trim() !== '',
    videoDetailsPanel_width: (value) => typeof value === 'number' && Number.isInteger(value),
    allCollectionSidebar_width: (value) => typeof value === 'number' && Number.isInteger(value),
    playlistsSidebar_width: (value) => typeof value === 'number' && Number.isInteger(value),
    currentSelectedPlaylist: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    currentSettingsTabIndex: (value) => typeof value === 'number' && Number.isInteger(value),
    isPlaylistAutoPlay: (value) => typeof value === 'boolean',
    isPlaylistShuffle: (value) => typeof value === 'boolean',
    isPlaylistRepeatPlay: (value) => typeof value === 'boolean',
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

const isValidMediaType = (mediaType) => Object.values(mediaTypes).includes(mediaType);

const isValidFileName = (fileName) => {
    if (!isNonEmptyString(fileName)) {
        return false;
    }

    if (path.basename(fileName) !== fileName) {
        return false;
    }

    return !/[\\/]/.test(fileName);
};

const isAbsoluteExistingDirectory = (targetPath) => {
    if (!isNonEmptyString(targetPath) || !path.isAbsolute(targetPath)) {
        return false;
    }

    try {
        return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
    } catch (error) {
        return false;
    }
};

const validateMediaId = (mediaId) => isNonEmptyString(mediaId);

const validateMediaList = (mediaList) =>
    Array.isArray(mediaList) && mediaList.every((item) => item && validateMediaId(item.id) && isValidMediaType(item.mediaType));

const validateUserPreferenceUpdate = (key, value) => {
    const validator = USER_PREFERENCE_VALIDATORS[key];
    if (!validator) {
        return respondError(`Unsupported user preference key: ${key}`);
    }

    if (!validator(value)) {
        return respondError(`Invalid value for user preference key: ${key}`);
    }

    return null;
};

const validateApplicationSettingUpdate = (key, value) => {
    const validator = APPLICATION_SETTINGS_VALIDATORS[key];
    if (!validator) {
        return respondError(`Unsupported application setting key: ${key}`);
    }

    if (!validator(value)) {
        return respondError(`Invalid value for application setting key: ${key}`);
    }

    return null;
};

const validateMediaOperationArgs = (mediaType, mediaId) => {
    if (!isValidMediaType(mediaType)) {
        return { status: 'error', message: `Unsupported media type: ${mediaType}` };
    }

    if (!validateMediaId(mediaId)) {
        return { status: 'error', message: 'Invalid media id provided' };
    }

    return null;
};

const validateRenameMediaArgs = (mediaType, mediaId, oldFileName, newFileName) => {
    const mediaValidationError = validateMediaOperationArgs(mediaType, mediaId);
    if (mediaValidationError) {
        return mediaValidationError;
    }

    if (!isValidFileName(oldFileName) || !isValidFileName(newFileName)) {
        return { status: 'error', message: 'Invalid file name provided for rename operation' };
    }

    return null;
};

const validateBulkMediaArgs = (mediaList) => {
    if (!validateMediaList(mediaList)) {
        return { status: 'error', message: 'Invalid media list provided' };
    }

    return null;
};

const validateWatchFolderRemoveArgs = (mediaId, watchFolderId, initiator) => {
    if (!validateMediaId(mediaId) || !isNonEmptyString(watchFolderId) || !isNonEmptyString(initiator)) {
        return { status: 'error', message: 'Invalid watch folder remove payload provided' };
    }

    return null;
};

const validateTheme = (theme) => {
    if (!['light', 'dark', 'system'].includes(theme)) {
        return { status: 'error', message: `Invalid theme value: ${theme}` };
    }

    return null;
};

const validateMediaDescription = (desc) => {
    if (!isNonEmptyString(desc) || desc.length > 1000) {
        return { status: 'error', message: 'Invalid media description provided' };
    }

    return null;
};

module.exports = {
    isNonEmptyString,
    isValidMediaType,
    isValidFileName,
    isAbsoluteExistingDirectory,
    validateMediaId,
    validateMediaList,
    validateUserPreferenceUpdate,
    validateApplicationSettingUpdate,
    validateRenameMediaArgs,
    validateBulkMediaArgs,
    validateWatchFolderRemoveArgs,
    validateTheme,
    validateMediaOperationArgs,
    validateMediaDescription,
};
