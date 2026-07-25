/* ========== COLLECTIONS ============ */
export const COLLECTION_LABEL_REGX = /^[a-zA-Z0-9][\sa-zA-Z0-9_.-]*[a-zA-Z0-9]$/;
export const COLLECTION_LABEL_MAX_LENGTH = 100;
export const COLLECTION_LABEL_MIN_LENGTH = 3;
export const BLACKLISTED_COLLECTION_LABELS = new Set(
    [
        'default collection',
        'dcim',
        '100apple',
        '101apple',
        '102apple',
        '103apple',
        '100msdcf',
        'mp_root',
        'mtp',
        'android',
        'data',
        'temp',
        'tmp',
        'misc',
        'clip',
        'arched',
    ].map((s) => s.toLowerCase()),
);

/* ==============   TAGS     =================== */
export const TAG_LABEL_REGX = /^[\sa-zA-Z0-9_.-]{2,80}$/;
export const TAG_LABEL_MAX_LENGTH = 80;
export const TAG_LABEL_MIN_LENGTH = 2;
export const BLACKLISTED_TAG_LABELS = new Set(['tag', 'new tag', 'untitled'].map((s) => s.toLocaleLowerCase()));

/* ==============   PLAYLISTS   =====================*/
export const PLAYLIST_LABEL_REGX = /^[a-zA-Z0-9 _-]{2,80}$/;
export const PLAYLIST_LABEL_MAX_LENGTH = 80;
export const PLAYLIST_LABEL_MIN_LENGTH = 2;
export const BLACKLISTED_PLAYLIST_LABELS = new Set(
    [
        'playlist',
        'new playlist',
        'untitled',
        'Newly added',
        'Top rated',
        'Most played',
        'Recently played',
        'Least played',
        'Most searched',
    ].map((s) => s.toLocaleLowerCase()),
);

/* ================ VIDEO FILE  ===================== */
export const VIDEO_FILE_NAME_PATTERN = '^[A-Za-z0-9](?:[A-Za-z0-9_\\-]{0,208}[A-Za-z0-9])?$';
export const VIDEO_FILE_NAME_REGX = new RegExp(VIDEO_FILE_NAME_PATTERN);
export const VIDEO_FILE_NAME_MAX_LENGTH = 200;
export const VIDEO_FILE_NAME_MIN_LENGTH = 1;

export const VIDEO_DESCRIPTION_MAX_LENGTH = 2000; // need to be same as defined in app.config.js
export const IMAGE_DESCRIPTION_MAX_LENGTH = 1000; // need to be same as defined in app.config.js
