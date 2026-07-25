const {
    removeTag,
    renameTag,
    addNewTag,
    getTags,
    addVideoToTag,
    initTagService,
    getTagsByVideoId,
    getMostUsedTagsList,
    removeVideoFromTag,
    getVideoIdsByTag,
} = require('./tags');
const { removeFromLastUsedTags, addToLastUsedTags } = require('../history/actionHistory');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const mainThreadEvents = require('../../events/mainThreadEvents');

const { emitToUI, respondSuccess, respondError } = require('../service-utils/sendToUI');
const { addImageToTag, getTagById, removeImageFromTag, addAudioToTag, removeAudioFromTag } = require('../database/tagsDbService');
const indexingEvents = require('../../events/indexingEvents');
const { getBasicVideoDetailsById } = require('../video-library/videoLibrary.service');

const removeTagService = (tag) => {
    try {
        const updatedTags = removeTag(tag);
        removeFromLastUsedTags(tag.id);
        return respondSuccess(`Tag "${tag.label}" removed successfully`, updatedTags);
    } catch (error) {
        return respondError(`Failed to remove tag: ${error.message}`);
    }
};

const renameTagService = (tagId, newTagLabel) => {
    try {
        const updatedTags = renameTag(tagId, newTagLabel);
        return respondSuccess(`Tag "${newTagLabel}" renamed successfully`, updatedTags);
    } catch (error) {
        return respondError(`Failed to rename tag: ${error.message}`);
    }
};

const addNewTagService = (tag) => {
    const tagId = tag.id;
    const tagLabel = tag.label;
    try {
        const updatedTags = addNewTag(tagId, tagLabel);
        addToLastUsedTags(tag);

        return respondSuccess(`tag "${tagLabel}" added successfully`, updatedTags);
    } catch (error) {
        return respondError(`Failed to add tag: ${error.message}`);
    }
};

const publishUpdateTags = (tags) => {
    emitToUI(mainThreadEvents.ON_TAGS_UPDATE, {
        tags: tags,
    });
};

const addVideoToNewTagService = (tagId, tagLabel, videoId) => {
    try {
        const updatedTags = addNewTag(tagId, tagLabel);

        addVideoToTag(tagId, videoId);
        serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
            change: indexingEvents.TAG_CHANGE,
            videoId: videoId,
            tagId: tagId,
        });

        publishUpdateTags(updatedTags);

        return respondSuccess('Tag ${tagLabel} added to video ${videoId}');
    } catch (e) {
        return respondError(`Failed to add tag: ${e.message}`);
    }
};

const addImageToNewTagService = (tagId, tagLabel, imageId) => {
    try {
        const updatedTags = addNewTag(tagId, tagLabel);

        addImageToTag(tagId, imageId);
        // we dont need to update for index data change
        publishUpdateTags(updatedTags);
        return respondSuccess(`Tag "${tagLabel}" added successfully to ${imageId}`);
    } catch (e) {
        return respondError(`Failed to add tag: ${e.message}`);
    }
};

const addAudioToNewTagService = (tagId, tagLabel, imageId) => {
    try {
        const updatedTags = addNewTag(tagId, tagLabel);

        addAudioToTag(tagId, imageId);
        // we dont need to update for index data change
        publishUpdateTags(updatedTags);
        return respondSuccess(`Tag "${tagLabel}" added successfully to ${imageId}`);
    } catch (e) {
        return respondError(`Failed to add tag: ${e.message}`);
    }
};

const _addRemoveTagCommonHandler = (tagId, videoId, operation) => {
    if (operation === 'add') {
        const tag = getTagById(tagId);
        addToLastUsedTags(tag);
        addVideoToTag(tagId, videoId);
    } else {
        removeVideoFromTag(tagId, videoId);
    }

    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
        change: indexingEvents.TAG_REMOVE,
        videoId: videoId,
        tagId: tagId,
    });
    return respondSuccess('Tag added to video successfully', {
        tagId: tagId,
        mediaId: videoId,
    });
};

const addVideoToTagService = (tagId, videoId) => _addRemoveTagCommonHandler(tagId, videoId, 'add');
const removeVideoFromTagService = (tagId, videoId) => _addRemoveTagCommonHandler(tagId, videoId, 'remove');

const _commonImageAddRemoveHandler = async (tagId, imageId, operation) => {
    try {
        if (operation === 'add') {
            const tag = getTagById(tagId);
            if (tag) {
                addToLastUsedTags(tag);
                addImageToTag(tagId, imageId);
            }
        } else {
            removeImageFromTag(tagId, imageId);
        }

        return respondSuccess('Tag added to image successfully', {
            tagId: tagId,
            mediaId: imageId,
        });
    } catch (e) {
        return respondError(`Failed to ${operation} tag to image: ${e.message}`);
    }
};

const addImageToTagService = (tagId, imageId) => _commonImageAddRemoveHandler(tagId, imageId, 'add');

const removeImageFromTagService = (tagId, imageId) => _commonImageAddRemoveHandler(tagId, imageId, 'remove');

const _commonAudioAddRemoveHandler = async (tagId, audioId, operation) => {
    try {
        if (operation === 'add') {
            const tag = getTagById(tagId);
            if (tag) {
                addToLastUsedTags(tag);
                addAudioToTag(tagId, audioId);
            }
        } else {
            removeAudioFromTag(tagId, audioId);
        }

        return respondSuccess('Tag added to audio successfully', {
            tagId: tagId,
            mediaId: audioId,
        });
    } catch (e) {
        return respondError(`Failed to ${operation} tag to audio: ${e.message}`);
    }
};

const addAudioToTagService = (tagId, audioId) => _commonAudioAddRemoveHandler(tagId, audioId, 'add');

const removeAudioFromTagService = (tagId, audioId) => _commonAudioAddRemoveHandler(tagId, audioId, 'remove');

const importTagsService = (arg) => {
    const tags = arg.tags;
    if (tags[0]) {
        let updatedTags = [];
        for (count = 0; count < tags.length; count++) {
            updatedTags = addNewTag(tags[count].id, tags[count].label);
        }
        publishUpdateTags(updatedTags);
    }
};

const getTopTagPlaylistDetails = (tagId) => {
    try {
        const videoIds = getVideoIdsByTag(tagId);

        if (videoIds.length > 0) {
            return respondSuccess(
                'Playlist created successfully',
                videoIds.map((item) => getBasicVideoDetailsById(item)),
            );
        } else {
            return respondSuccess('No videos found for this tag', []);
        }
    } catch (error) {
        return respondError('No video found with this tag. Please check if tag is associated with any video.');
    }
};

module.exports = {
    addNewTagService,
    removeTagService,
    renameTagService,
    getTags,
    addVideoToNewTagService,
    initTagService,
    addVideoToTagService,
    removeVideoFromTagService,
    importTagsService,
    getTopTagPlaylistDetails,
    getMostUsedTagsList,
    getTagsByVideoId,

    // images
    addImageToNewTagService,
    addImageToTagService,
    removeImageFromTagService,

    // audios
    addAudioToNewTagService,
    addAudioToTagService,
    removeAudioFromTagService,
};
