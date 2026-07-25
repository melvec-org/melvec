const systemConfig = {
    WATCH_FOLDERS_DB_DIR: 'watch-folders',
    SUPPORTED_VIDEO_EXTENSIONS: /\.(mp4|mkv|mov)$/i,
    SUPPORTED_VIDEO_FORMATS: /^(mp4|mkv|mov)$/i,
    SUPPORTED_IMAGE_EXTENSIONS: /\.(jpg|jpeg|png|webp)$/i,
    SUPPORTED_IMAGE_FORMATS: /^(jpg|jpeg|png|webp)$/i,
    SUPPORTED_AUDIO_EXTENSIONS: /\.(mp3|aac|wav|flac|ogg)$/i,
    SUPPORTED_AUDIO_FORMATS: /^(mp3|aac|wav|flac|ogg)$/i,
    SUPPORTED_MEDIA_EXTENSIONS: /\.(mp4|mkv|mov|jpg|jpeg|png|webp|mp3|aac|wav|flac|ogg)$/i,

    DEFAULT_COLLECTION_NAME: 'Default collection',
    DEFAULT_COLLECTION_YEAR: 10000,
    DEFAULT_COLLECTION_ID: '00000000',
    MAX_RECENTLY_USED_LIBRARY_PATH_COUNT: 5,
    PRIVATE_DIR: '/._v_/',
    LIBRARY_DIR: '_lib_',
    PREVIEW_DIR: '._pvw_',
    THUMBNAILS_DIR: '_th_',
    TRASHBIN_DIR: 'melvec_trash',
    SYSTEM_DIRECTORY_LIST_REGEX: /._v_|_lib_|_th_|._pvw_|melvec_trash|.DS_Store/i,
};

module.exports = systemConfig;
