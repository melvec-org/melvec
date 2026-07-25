const indexingEvents = {
    COLLECTION_UPDATE: 'collectionChanged',
    COLLECTION_REMOVE: 'collectionRemoved',

    TAG_CHANGE: 'tagChanged',
    TAG_REMOVE: 'tagRemoved',
    PLAYLIST_ADD: 'playlistAdded',
    PLAYLIST_REMOVE: 'playlistRemoved',
    PLAYLIST_UPDATE: 'playlistChanged',

    // VIDEOS
    VIDEO_DELETE: 'videoDeleted',
    VIDEO_TITLE_CHANGE: 'videoTitleChanged',
    VIDEO_PLAYLIST_CHANGE: 'videoPlaylistChanged',
    VIDEO_COLLECTION_CHANGE: 'videoCollectionChanged',
    VIDEO_CATEGORY_CHANGE: 'videoCategoryChanged',
    VIDEO_META_DATA_CHANGE: 'videoMetaDataChanged',

    IMAGE_DELETE: 'imageDeleted',
    IMAGE_TITLE_CHANGE: 'imageTitleChanged',
    IMAGE_COLLECTION_CHANGE: 'imageCollectionChanged',
    IMAGE_META_DATA_CHANGE: 'imageMetaDataChanged',

    // IMAGES
    AUDIO_DELETE: 'audioDeleted',
    AUDIO_TITLE_CHANGE: 'audioTitleChanged',
    AUDIO_COLLECTION_CHANGE: 'audioCollectionChanged',
    AUDIO_META_DATA_CHANGE: 'audioMetaDataChanged',
};
module.exports = indexingEvents;
