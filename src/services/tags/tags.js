const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');

const {
    addTag,
    getTags,
    cleanupVideoFromTags,
    initializeDb,
    getTagById,
    getVideoIdsByTag,
    removeVideoFromTag,
    removeTagById,
    addVideoToTag,
    getTagsByVideoId,
    renameTagById,
    getTagsByImageId,
} = require('../database/tagsDbService.js');
const { MAX_TOP_TAGS_LIST_LENGTH } = require('../../configs/appConfig');

const addNewTag = (id, label) => {
    addTag(id, label);
    return getTags();
};

const removeTag = (tag = {}) => {
    if (tag.id) {
        removeTagById(tag.id);
        return getTags();
    }
    return null;
};

const renameTag = (tagId, newLabel) => {
    renameTagById(tagId, newLabel);
    return getTags();
};

const getMostUsedTagsList = () => {
    let tagsWithItemCount = [];

    const tags = getTags();

    tags.forEach((tag) => {
        const videosLen = getVideoIdsByTag(tag.id).length || 0;
        tagsWithItemCount.push({ tagId: tag.id, len: videosLen });
    });

    tagsWithItemCount = tagsWithItemCount.filter((tag) => tag.len > 0);

    tagsWithItemCount = tagsWithItemCount.sort((tag1, tag2) => (tag1.len < tag2.len ? 1 : tag1.len > tag2.len ? -1 : 0));

    tagsWithItemCount = tagsWithItemCount.slice(0, MAX_TOP_TAGS_LIST_LENGTH);

    return tagsWithItemCount.map((item) => getTagById(item.tagId));
};

const onVideoDelete = ({ videoId }) => cleanupVideoFromTags(videoId);

const initTagService = () => {
    initializeDb();

    serviceEventBus.subscribe(interServiceEvents.DELETE_VIDEO, onVideoDelete);
};

module.exports = {
    initTagService,

    // get operations
    getTags,
    getVideoIdsByTag,
    getTagsByVideoId,
    getMostUsedTagsList,

    // add operations
    addNewTag,
    addVideoToTag,

    // remove operations
    removeTag,
    removeVideoFromTag,

    renameTag,

    // images

    getTagsByImageId,
};
