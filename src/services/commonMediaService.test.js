jest.mock('./video-library/videoLibrary.service', () => ({
    updateVideoTitleService: jest.fn(),
    updateNsfwStatusService: jest.fn(),
    renameVideoFile: jest.fn(),
    removeVideoFromLibrary: jest.fn(),
    removeVideoFromLibraryService: jest.fn(),
}));

jest.mock('./video-library/videoLibrary', () => ({
    updateNsfwStatus: jest.fn(),
    updateVideoCategory: jest.fn(),
    resetVideosMetaData: jest.fn(),
}));

jest.mock('./image-library/imageLibrary.service', () => ({
    updateImageTitleService: jest.fn(),
    updateImageNsfwStatusService: jest.fn(),
    renameImageFileService: jest.fn(),
    removeImageFromLibrary: jest.fn(),
    updateImageNsfwStatus: jest.fn(),
    resetImagesMetaData: jest.fn(),
}));

jest.mock('../services/collections/collections.service', () => ({
    moveVideoFromOneCollectionToAnother: jest.fn(),
    moveImageFromOneCollectionToAnother: jest.fn(),
}));

jest.mock('./tags/tags.service', () => ({
    addVideoToTagService: jest.fn(),
    addImageToTagService: jest.fn(),
    addImageToNewTagService: jest.fn(),
    addVideoToNewTagService: jest.fn(),
    removeImageFromTagService: jest.fn(),
    removeVideoFromTagService: jest.fn(),
}));

jest.mock('./watch-folders/watchFolders', () => ({
    removeWatchFolderMedia: jest.fn(),
}));

jest.mock('./thumbnail/thumbnail', () => ({
    deleteThumbnail: jest.fn(),
}));

jest.mock('./database/collectionsDbService', () => ({
    getCollectionDetailsById: jest.fn(),
}));

jest.mock('./service-utils/sendToUI', () => ({
    respond: jest.fn((status, message, data) => ({ status, message, data })),
    respondSuccess: jest.fn((message, data = null) => ({ status: 'success', message, data })),
    respondFailure: jest.fn((message, data = null) => ({ status: 'failure', message, data })),
    respondError: jest.fn((message) => ({ status: 'error', message })),
}));

const { renameVideoFile } = require('./video-library/videoLibrary.service');
const { renameImageFileService } = require('./image-library/imageLibrary.service');
const { respondError } = require('./service-utils/sendToUI');
const { renameMediaFileService } = require('./commonMediaService');

describe('renameMediaFileService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('delegates to renameVideoFile for video mediaType', async () => {
        renameVideoFile.mockResolvedValue({ status: 'success', message: 'File name updated successfully' });

        await renameMediaFileService('video', 'vid-1', 'old.mp4', 'new.mp4');

        expect(renameVideoFile).toHaveBeenCalledWith('vid-1', 'old.mp4', 'new.mp4');
        expect(renameImageFileService).not.toHaveBeenCalled();
    });

    it('delegates to renameImageFileService for image mediaType', async () => {
        renameImageFileService.mockResolvedValue({ status: 'success', message: 'File name updated successfully' });

        await renameMediaFileService('image', 'img-1', 'old.jpg', 'new.jpg');

        expect(renameImageFileService).toHaveBeenCalledWith('img-1', 'old.jpg', 'new.jpg');
        expect(renameVideoFile).not.toHaveBeenCalled();
    });

    it('returns an error response for an unsupported media type', () => {
        renameMediaFileService('audio', 'media-1', 'old.mp3', 'new.mp3');

        expect(respond).toHaveBeenCalledWith('error', 'Unsupported media type: audio');
        expect(renameVideoFile).not.toHaveBeenCalled();
        expect(renameImageFileService).not.toHaveBeenCalled();
    });
});
