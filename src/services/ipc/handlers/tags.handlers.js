const serviceMethods = require('../../../constants/serviceMethods');
const {
    addNewTagService,
    removeTagService,
    renameTagService,
    getTags,
    getTopTagPlaylistDetails,
    getMostUsedTagsList,
} = require('../../tags/tags.service');
const { getLastUsedTagsList } = require('../..//history/actionHistory.service');
const { addMediaToNewTagService, addMediaToTagService, removeMediaFromTagService } = require('../../commonMediaService');

const tagsServiceHandlers = [
    //  ========== TAGS ==============
    [serviceMethods.TAGS_GET_ALL, async () => getTags()],
    [serviceMethods.TAGS_ADD_NEW, async (tag) => addNewTagService(tag)],
    [serviceMethods.TAGS_REMOVE, async (tag) => removeTagService(tag)],
    [serviceMethods.TAGS_RENAME, async (tagId, newLabel) => renameTagService(tagId, newLabel)],
    [serviceMethods.TAGS_GET_MOST_USED_LIST, async () => getMostUsedTagsList()],
    [serviceMethods.TAGS_GET_LAST_USED_LIST, async () => getLastUsedTagsList()],
    [serviceMethods.TAGS_GET_TOP_TAG_PLAYLIST_DETAILS, async (tagId = '') => getTopTagPlaylistDetails(tagId)],
    [
        serviceMethods.TAGS_ADD_MEDIA_TO_NEW_TAG,
        async (mediaType, mediaId, tagId, tagLabel) => addMediaToNewTagService(mediaType, mediaId, tagId, tagLabel),
    ],

    [serviceMethods.TAGS_ADD_MEDIA_TO_TAG, async (mediaType, mediaId, tagId) => addMediaToTagService(mediaType, mediaId, tagId)],
    [serviceMethods.TAGS_REMOVE_MEDIA_FROM_TAG, async (mediaType, mediaId, tagId) => removeMediaFromTagService(mediaType, mediaId, tagId)],
];

module.exports = { tagsServiceHandlers };
