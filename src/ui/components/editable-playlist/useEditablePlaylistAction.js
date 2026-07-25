import rendererEvents from '__events/rendererEvents';
import ipcChannels from '__constants/ipcChannels';

const useEditablePlaylistAction = () => {
    // Your logic here
    const addNewPlaylistToVideo = (videoId, playlist) => {
        window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
            event: rendererEvents.ADD_NEW_PLAYLIST_TO_VIDEO,
            playlist: playlist,
            videoId: videoId,
        });
    };

    const removeVideoFromPlaylist = (videoId, playlist) => {
        window.api.removeVideoFromPlaylist(videoId, playlist);
    };

    const addVideoToPlaylist = (videoId, playlist) => {
        window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
            event: rendererEvents.PLAYLIST_ADD_VIDEO,
            playlist: playlist,
            videoId: videoId,
        });
    };

    return {
        // Your functions here
        addNewPlaylistToVideo,
        removeVideoFromPlaylist,
        addVideoToPlaylist,
    };
};

export default useEditablePlaylistAction;
