const { getVideoIdsByTag } = require('../../tags/tags');
const { getImageIdsByTag } = require('../../database/tagsDbService');
const { getTags } = require('../../tags/tags');
const mediaTypes = require('../../../constants/mediaTypes');
const { getImagesByTitleDbSearch, getImagesByFileNameSearch } = require('../../database/imageLibraryDbService');
const { getAudiosByFileNameSearch, getAudiosByTitleDbSearch } = require('../../database/audioLibraryDbService');

const { getVideoByTitleSearch, getVideosByFileNameSearch: getVideoByFileNameDbSearch } = require('../../database/videoLibraryDbService');

const { getImagesByMetaData } = require('./getImagesByMetaData');
const { getAudiosByMetaData } = require('./getAudiosByMetaData');
const { getVideosByMetaData } = require('./getVideosByMetaData');

const getMediaByTagSearch = (keyword) => {
    const allTags = getTags();
    const tagMatches = allTags.filter((tag) => tag.label.toLowerCase().includes(keyword));
    const tagMatchedVideos = tagMatches.map((item) => getVideoIdsByTag(item.id));
    const tagMatchedImages = tagMatches.map((item) => getImageIdsByTag(item.id));
    const allVideos = tagMatchedVideos.reduce((acc, videos) => acc.concat(videos), []);
    const allImages = tagMatchedImages.reduce((acc, images) => acc.concat(images), []);
    const allAudios = tagMatchedImages.reduce((acc, audios) => acc.concat(audios), []);

    const uniqueVideos = [...new Set(allVideos)].map((id) => ({
        id,
        mediaType: mediaTypes.VIDEO,
    }));

    const uniqueImages = [...new Set(allImages)].map((id) => ({
        id,
        mediaType: mediaTypes.IMAGE,
    }));

    const uniqueAudios = [...new Set(allAudios)].map((id) => ({
        id,
        mediaType: mediaTypes.AUDIO,
    }));

    return [...uniqueVideos, ...uniqueImages, ...uniqueAudios];
};
const normalizeResultsByMediaType = (items, mediaType) => {
    return (items || []).map((item) => ({
        ...item,
        mediaType,
    }));
};

const mediaByTitleSearch = (keyword) => {
    const videoMatches = normalizeResultsByMediaType(getVideoByTitleSearch(keyword), mediaTypes.VIDEO);
    const imageMatches = normalizeResultsByMediaType(getImagesByTitleDbSearch(keyword), mediaTypes.IMAGE);
    const audioMatches = normalizeResultsByMediaType(getAudiosByTitleDbSearch(keyword), mediaTypes.AUDIO);

    return [...videoMatches, ...imageMatches, ...audioMatches];
};

const getMediaByFileNameSearch = (keyword) => {
    const videoMatches = normalizeResultsByMediaType(getVideoByFileNameDbSearch(keyword), mediaTypes.VIDEO);
    const imageMatches = normalizeResultsByMediaType(getImagesByFileNameSearch(keyword), mediaTypes.IMAGE);
    const audioMatches = normalizeResultsByMediaType(getAudiosByFileNameSearch(keyword), mediaTypes.AUDIO);

    return [...videoMatches, ...imageMatches, ...audioMatches];
};

const getMediaByMetaDataSearch = async (searchText, isQuickSearch, mediaTypeFilter = null) => {
    // most possible case
    if (mediaTypeFilter === null) {
        const videoMatches = normalizeResultsByMediaType(await getVideosByMetaData(searchText, isQuickSearch), mediaTypes.VIDEO);
        const imageMatches = normalizeResultsByMediaType(await getImagesByMetaData(searchText, isQuickSearch), mediaTypes.IMAGE);
        const audioMatches = normalizeResultsByMediaType(await getAudiosByMetaData(searchText, isQuickSearch), mediaTypes.AUDIO);

        return [...videoMatches, ...imageMatches, ...audioMatches];
    } else {
        // only if filter is applied.
        const matches = [];
        if (mediaTypeFilter.includes(mediaTypes.VIDEO)) {
            matches.push(...normalizeResultsByMediaType(await getVideosByMetaData(searchText, isQuickSearch), mediaTypes.VIDEO));
        }
        if (mediaTypeFilter.includes(mediaTypes.IMAGE)) {
            matches.push(...normalizeResultsByMediaType(await getImagesByMetaData(searchText, isQuickSearch), mediaTypes.IMAGE));
        }
        if (mediaTypeFilter.includes(mediaTypes.AUDIO)) {
            matches.push(...normalizeResultsByMediaType(await getAudiosByMetaData(searchText, isQuickSearch), mediaTypes.AUDIO));
        }
        return matches;
    }
};

module.exports = {
    getMediaByTagSearch,
    mediaByTitleSearch,
    getMediaByFileNameSearch,
    getMediaByMetaDataSearch,
};
