const mainThreadEvents = require('../../events/mainThreadEvents');
const { getPlaylists, getPlaylistsByVideoId, checkPlaylistExists, addVideoToPlaylist } = require('../database/playlistsDbService');
const { getTags, getTagsByVideoId, checkTagExists, addVideoToTag } = require('../database/tagsDbService');
const { getAllVideos, checkVideoExists } = require('../database/videoLibraryDbService');
const { logLibraryError } = require('../logs/logService');
const { getVideoMetricsByVideoId, updateContentQuality, updateContentRating, updateViews } = require('../video-metrics/videoMetrics');
const { addNewPlaylist } = require('../playlists/playlists');
const { addNewTag } = require('../tags/tags');
const { udpateVideoTitle } = require('../video-library/videoLibrary');
const { respondFailure, respondSuccess } = require('../service-utils/sendToUI');

const exportAllMetaData = async (config) => {
    const allMetaData = {
        tags: getTags(),
        playlists: getPlaylists(),
        videos: [], // Add video metadata here
    };

    const allVideos = getAllVideos();
    let videosMetaData = allVideos.map((videoData) => {
        const defaultMetaData = { views: 0, content_quality: 0, rating: 0 };
        const metaData = getVideoMetricsByVideoId(videoData.id) || defaultMetaData;

        let finalMetaData = {
            id: videoData.id,
        };

        if (videoData.title && videoData.title.trim() !== '') {
            finalMetaData['title'] = videoData.title;
        }

        const tags = getTagsByVideoId(videoData.id);
        if (tags && tags.length > 0) {
            finalMetaData['tags'] = tags.map((item) => item.id);
        }

        const playlists = getPlaylistsByVideoId(videoData.id);
        if (playlists && playlists.length > 0) {
            finalMetaData['playlists'] = playlists.map((item) => item.id);
        }

        const views = metaData.views || 0;
        if (views > 0) {
            finalMetaData['views'] = views;
        }

        const quality = metaData.content_quality || 0;
        if (quality > 0) {
            finalMetaData['quality'] = quality;
        }
        const rating = metaData.rating || 0;
        if (rating > 0) {
            finalMetaData['rating'] = rating;
        }

        return finalMetaData;
    });

    // further reduce metadata if there is no data present for the video.
    videosMetaData = videosMetaData.filter((item) => Object.keys(item).length > 1);
    allMetaData.videos = videosMetaData;

    if (videosMetaData.length > 0 || allMetaData.tags.length > 0 || allMetaData.playlists.length > 0) {
        return respondSuccess('', allMetaData);
    } else {
        return respondFailure('No video metadata found for the videos');
    }
};

const importAllMetaData = async (data) => {
    if (data.tags.length > 0) {
        data.tags.forEach((tag) => {
            try {
                const doesTagExist = checkTagExists(tag.id);
                if (!doesTagExist) {
                    addNewTag(tag.id, tag.label);
                }
            } catch (error) {
                logLibraryError(error);
            }
        });
    }
    // if data.playlists is not empty, save the playlists into database,
    if (data.playlists.length > 0) {
        data.playlists.forEach((playlist) => {
            // Add playlist to database
            try {
                const doesPlaylistExist = checkPlaylistExists(playlist.id);
                addNewPlaylist(playlist.id, playlist.label);
            } catch (error) {
                logLibraryError(error);
            }
        });
    }
    // if data.videos is not empty, save the videos into database,
    if (data.videos.length > 0) {
        data.videos.forEach((video) => {
            // Add video to database
            const { id, title, tags, playlists, views, quality, rating } = video;

            const doesVideoExist = checkVideoExists(id);

            if (doesVideoExist) {
                if (title) {
                    udpateVideoTitle(id, title);
                }

                if (tags && tags.length > 0) {
                    const tagsForVideos = getTagsByVideoId(id);
                    tags.forEach((tagId) => {
                        const doesTagExist = tagsForVideos.find((item) => item.id === tagId);
                        if (!doesTagExist) {
                            addVideoToTag(tagId, id);
                        }
                    });
                }

                if (playlists && playlists.length > 0) {
                    const playlistsForVideos = getPlaylistsByVideoId(id).map((item) => item.id);
                    playlists.forEach((playlistId) => {
                        if (!playlistsForVideos.includes(playlistId)) {
                            addVideoToPlaylist(playlistId, id);
                        }
                    });
                }

                if (views && views >= 1) {
                    updateViews(id, video.views);
                }
                if (quality) {
                    updateContentQuality(id, quality);
                }
                if (rating) {
                    updateContentRating(id, rating);
                }
            }
        });
    }

    return respondSuccess('All metadata imported successfully');
};

module.exports = {
    exportAllMetaData,
    importAllMetaData,
};
