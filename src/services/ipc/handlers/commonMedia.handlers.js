const {
    validateRenameMediaArgs,
    validateBulkMediaArgs,
    isNonEmptyString,
    validateMediaOperationArgs,
} = require('../../service-utils/ipcValidation');
const serviceMethods = require('../../../constants/serviceMethods');

const {
    updateMediaNsfwStatusService,
    updateMediaTitleService,
    renameMediaFileService,
    bulkRemoveMediaService,
    bulkMediaNsfwStatusService,
    bulkMediaCategoryService,
    bulkMediaCollectionChangeService,
    removeMediaService,
    bulkMediaMetaDataResetService,
} = require('../../commonMediaService');

const commonMediaServiceHandlers = [
    [serviceMethods.MEDIA_UPDATE_TITLE, async (mediaType, videoId, title) => updateMediaTitleService(mediaType, videoId, title)],
    [
        serviceMethods.MEDIA_RENAME_FILE,
        async (mediaType, mediaId, oldFileName, newFileName) => {
            const validationError = validateRenameMediaArgs(mediaType, mediaId, oldFileName, newFileName);
            if (validationError) {
                return validationError;
            }

            return renameMediaFileService(mediaType, mediaId, oldFileName, newFileName);
        },
    ],

    [
        serviceMethods.MEDIA_UPDATE_NSFW_STATUS,

        async (mediaType, mediaId, isNsfw) => updateMediaNsfwStatusService(mediaType, mediaId, isNsfw),
    ],

    [
        serviceMethods.MEDIA_BULK_REMOVE,
        async (mediaList, collectionId, isExternal) => {
            const validationError = validateBulkMediaArgs(mediaList);
            if (validationError) {
                return validationError;
            }

            return bulkRemoveMediaService(mediaList, collectionId, isExternal);
        },
    ],

    [
        serviceMethods.MEDIA_BULK_UPDATE_NSFW_STATUS,
        async (mediaList, isNsfw) => {
            const validationError = validateBulkMediaArgs(mediaList);
            if (validationError) {
                return validationError;
            }

            return bulkMediaNsfwStatusService(mediaList, isNsfw);
        },
    ],
    [
        serviceMethods.MEDIA_BULK_UPDATE_CATEGORY,
        async (mediaList, categoryId) => {
            const validationError = validateBulkMediaArgs(mediaList);
            if (validationError) {
                return validationError;
            }

            return bulkMediaCategoryService(mediaList, categoryId);
        },
    ],
    [
        serviceMethods.MEDIA_BULK_UPDATE_COLLECTION,
        async (mediaList, newCollectionId) => {
            const validationError = validateBulkMediaArgs(mediaList);
            if (validationError) {
                return validationError;
            }

            if (!isNonEmptyString(newCollectionId)) {
                return { status: 'error', message: 'Invalid collection id provided' };
            }

            return bulkMediaCollectionChangeService(mediaList, newCollectionId);
        },
    ],
    [
        serviceMethods.MEDIA_REMOVE_FROM_LIBRARY,
        async (mediaType, mediaId, initiator) => {
            const validationError = validateMediaOperationArgs(mediaType, mediaId);
            if (validationError) {
                return validationError;
            }

            if (!isNonEmptyString(initiator)) {
                return { status: 'error', message: 'Invalid initiator provided' };
            }

            return removeMediaService(mediaType, mediaId, initiator);
        },
    ],
    [
        serviceMethods.MEDIA_BULK_RESET_METADATA,
        async (mediaList, metaDataList = []) => {
            const validationError = validateBulkMediaArgs(mediaList);
            // metaDataList is right now ignored, and all meta data will be cleared as of now. In future selective meta data reset will be implemented.
            if (validationError) {
                return validationError;
            }

            return bulkMediaMetaDataResetService(mediaList, metaDataList);
        },
    ],
];
module.exports = {
    commonMediaServiceHandlers,
};
