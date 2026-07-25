import mediaTypes from '__constants/mediaTypes';
import getVideoImage from './createVideoThumbnails';
import ipcChannels from '__constants/ipcChannels';
import rendererEvents from '__events/rendererEvents';

const missingThumbnailsCache = new Map();
let isThumbnailCreationInProgress = false;
const THUMBNAIL_CREATION_INTERVAL = 100;
/**
 * sleeper function to gap executions
 * @param ms
 * @returns {Promise<unknown>}
 */
const timeout = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

const onMissingThumbnailFound = (id, path, isExternal, mediaType) => {
    if (mediaType === mediaTypes.VIDEO) {
        if (!missingThumbnailsCache.get(id)) {
            missingThumbnailsCache.set(id, {
                id,
                path,
                isExternal,
            });
        }

        if (!isThumbnailCreationInProgress) {
            startExtractingThumbnail();
        }
    } else if (mediaType === mediaTypes.IMAGE) {
        window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
            event: rendererEvents.THUMBNAIL_CREATE,
            mediaType: mediaTypes.IMAGE,
            mediaPath: path,
            mediaId: id,
            isExternal,
        });
    }
};

const startExtractingThumbnail = async () => {
    isThumbnailCreationInProgress = true;

    while (missingThumbnailsCache.size > 0) {
        const [thumbnailId, videoDetails] = missingThumbnailsCache.entries().next().value;

        try {
            await timeout(THUMBNAIL_CREATION_INTERVAL);

            await getVideoImage(videoDetails.id, videoDetails.path, videoDetails.isExternal);
        } catch (err) {
            console.error(`Thumbnail creation failed for ${thumbnailId}:`, err);
        } finally {
            missingThumbnailsCache.delete(thumbnailId);
        }
    }

    isThumbnailCreationInProgress = false;
    return Promise.resolve();
};
export default onMissingThumbnailFound;
