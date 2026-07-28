const mainThreadEvents = require('../../events/mainThreadEvents');
const {
    addNewPlaylist,
    removePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    getVideoIdsByPlaylist,
    initPlaylistsService,
    getPlaylists,
    getMostUsedPlaylists,
    renamePlaylist,
} = require('./playlists');
const { addToLastUsedPlaylists, removeFromLastUsedPlaylists } = require('../history/actionHistory');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { emitToUI, respond, respondSuccess, respondError } = require('../service-utils/sendToUI');
const { getFullVideoDetailsById, getBasicVideoDetailsById } = require('../video-library/videoLibrary.service');
const { addMultipleVideosToPlaylist, updateVideoOrderInPlaylist } = require('../database/playlistsDbService');
const indexingEvents = require('../../events/indexingEvents');

const publishUpdatePlaylist = (playlists) => {
    emitToUI(mainThreadEvents.ON_PLAYLIST_UPDATE, {
        playlists: playlists,
    });
};

const addNewPlaylistService = (playlist) => {
    try {
        const updatedPlaylist = addNewPlaylist(playlist.id, playlist.label);

        addToLastUsedPlaylists(playlist);
        return respondSuccess(`Playlist "${playlist.label}" added successfully`, updatedPlaylist);
    } catch (error) {
        return respondError(`Failed to add playlist: ${error.message}`);
    }
};

const removePlaylistService = (playlist) => {
    try {
        const updatedPlaylist = removePlaylist(playlist);
        removeFromLastUsedPlaylists(playlist.id);

        return respondSuccess(`Playlist "${playlist.label}" removed successfully.`, updatedPlaylist);
    } catch (error) {
        return respondError(`Failed to remove playlist: ${error.message}`);
    }
};

/**
 * Add any existing playlist to a video service
 * @param {*} arg
 */
const addVideoToPlaylistService = (arg) => {
    const playlistId = arg?.playlist?.id;
    const videoId = arg?.videoId;

    addToLastUsedPlaylists(arg.playlist);
    addVideoToPlaylist(playlistId, videoId);

    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
        change: indexingEvents.VIDEO_PLAYLIST_CHANGE,
        videoId: videoId,
        playlistId: playlistId,
    });

    emitToUI(mainThreadEvents.ON_VIDEO_DETAILS_UPDATE, {
        updatedVideoDetails: getFullVideoDetailsById(videoId),
    });
};

const addMultipleVideosToPlaylistService = (arg) => {
    const videoIds = arg?.videoIds;
    const playlistId = arg?.playlist?.id;

    try {
        const info = addMultipleVideosToPlaylist(playlistId, videoIds);

        if (info) {
            return respondSuccess(`Videos added to playlist "${arg.playlist.label}" successfully.`);
        }
    } catch (error) {
        return respondError(`Failed to add videos to playlist: ${error.message}`);
    }
};

/**
 * When new playlist is being created and being associated with a video.
 * @param {} arg
 */
const addNewPlaylistToVideoService = (arg) => {
    const playlistId = arg?.playlist?.id;
    const playlistLabel = arg?.playlist?.label;
    const videoId = arg?.videoId;

    const updatedPlaylists = addNewPlaylist(playlistId, playlistLabel);

    addVideoToPlaylist(playlistId, videoId);
    addToLastUsedPlaylists({ id: playlistId, label: playlistLabel });
    serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
        change: indexingEvents.PLAYLIST_ADD,
        videoId: videoId,
        playlistId: playlistId,
    });
    publishUpdatePlaylist(updatedPlaylists);
};

const removeVideoFromPlaylistService = (playlistId, videoId) => {
    try {
        const action = removeVideoFromPlaylist(playlistId, videoId);
        if (action) {
            serviceEventBus.publish(interServiceEvents.INDEX_DATA_CHANGED, {
                change: indexingEvents.VIDEO_PLAYLIST_CHANGE,
                videoId: videoId,
                playlistId: playlistId,
            });

            const updatedVideoDetails = getVideoIdsByPlaylist(playlistId);

            emitToUI(mainThreadEvents.ON_VIDEO_DETAILS_UPDATE, {
                updatedVideoDetails: getFullVideoDetailsById(videoId),
            });

            return respondSuccess('Video removed from playlist successfully', updatedVideoDetails);
        }
    } catch (error) {
        return respondError(`Some problem in removing video from playlist. Error details: ${error.message}`);
    }
};

const getPlaylistDetails = (playlistId) => {
    try {
        const videoIdsByPlaylist = getVideoIdsByPlaylist(playlistId);
        return respondSuccess(
            'Playlist found',
            videoIdsByPlaylist.map((id) => getBasicVideoDetailsById(id)),
        );
    } catch (error) {
        return respondError(`Failed to get playlist details: ${error.message}`);
    }
};

const renamePlaylistService = (playlistId, playlistName) => {
    try {
        const updatedPlaylist = renamePlaylist(playlistId, playlistName);

        webContents.send('notify', {
            type: 'info',
            message: `Playlist "${playlistName}" renamed successfully`,
        });
        return respondSuccess(`Playlist "${playlistName}" renamed successfully`, updatedPlaylist);
    } catch (error) {
        return respondError(`Failed to rename playlist: ${error.message}`);
    }
};

const reorderVideosInPlaylistService = (playlistId, videoId, newPosition) => {
    try {
        if (!videoId || typeof videoId !== 'string' || videoId.trim() === '') {
            throw new Error('videoId must be a non-empty string');
        }
        if (!Number.isInteger(newPosition) || newPosition < 0) {
            throw new Error('newPosition must be a non-negative integer');
        }

        const currentVideoIds = getVideoIdsByPlaylist(playlistId);
        if (!Array.isArray(currentVideoIds) || currentVideoIds.length === 0) {
            throw new Error(`Playlist ${playlistId} has no videos to reorder.`);
        }

        const currentIndex = currentVideoIds.indexOf(videoId);
        if (currentIndex === -1) {
            throw new Error(`Video ${videoId} is not part of playlist ${playlistId}.`);
        }

        currentVideoIds.splice(currentIndex, 1);

        const targetIndex = Math.min(newPosition, currentVideoIds.length);

        currentVideoIds.splice(targetIndex, 0, videoId);

        const result = updateVideoOrderInPlaylist(playlistId, currentVideoIds);

        return respond('success', `Reordered video ${videoId} in playlist ${playlistId} successfully.`);
    } catch (error) {
        return respond('error', `Failed to reorder videos in playlist: ${error.message}`);
    }
};

module.exports = {
    publishUpdatePlaylist,
    addNewPlaylistService,
    removePlaylistService,
    addVideoToPlaylistService,
    addMultipleVideosToPlaylistService,
    addNewPlaylistToVideoService,
    removeVideoFromPlaylistService,
    getPlaylistDetails,
    renamePlaylistService,
    initPlaylistsService,
    getPlaylists,
    getMostUsedPlaylists,
    reorderVideosInPlaylistService,
};
