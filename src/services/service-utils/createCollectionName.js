const JUNK_FOLDERS = new Set(
    [
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

const GENERIC_FOLDERS = new Set(
    [
        'downloads',
        'download',
        'export',
        'exports',
        'backup',
        'backups',
        'whatsapp video',
        'whatsapp',
        'untitled folder',
        'untitled',
        'new folder',
        'camera',
        'camera roll',
        'videos',
        'video',
        'movies',
        'recordings',
        'clips',
        'imported',
        'shared',
        'temp',
        'temporary',
        'mobile',
    ].map((s) => s.toLowerCase()),
);
const DEFAULT_COLLECTION = 'Untitled';

// Taking, mac, windows and external hdd into consideration
const MAX_SAFE_LENGTH = 100;
const FALLBACK_HASH_LENGTH = 8;

const simpleHash = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h >>>= 0;
    }
    return Math.abs(h).toString(36);
};

/**
 * Creates a clean, human-readable collection name from a relative path.
 * Used for organizing videos into meaningful folders.
 *
 * @param {string} relativePath - e.g. "Family/Vacation/2025/Jan/beach.mp4"
 * @returns {string} - e.g. "Jan" or "Projects ─ 2025 ─ Jan" or "Untitled"
 */

const createCollectionName = (relativePath) => {
    const parts = relativePath
        .split(/[\\/]/)
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length <= 1) return DEFAULT_COLLECTION;

    const folders = parts.slice(0, -1); // remove filename

    // Remove known junk folders completely
    const cleaned = folders.filter((f) => !JUNK_FOLDERS.has(f.toLowerCase()));
    if (cleaned.length === 0) return DEFAULT_COLLECTION;

    // Build result: skip generic folders only if a meaningful one exists deeper
    const result = [];
    let hasMeaningful = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
        const folder = cleaned[i];
        const isGeneric = GENERIC_FOLDERS.has(folder.toLowerCase());

        if (hasMeaningful && isGeneric) continue; // skip generic parent

        result.unshift(folder);
        if (!isGeneric) hasMeaningful = true;
    }

    if (result.length === 0) return DEFAULT_COLLECTION;

    let name = result.join('-');

    // trim the collection name safely so that we don't get too long
    if (name.length > MAX_SAFE_LENGTH) {
        // Keep the most important parts: beginning + end + deterministic hash
        const hash = simpleHash(relativePath).slice(0, FALLBACK_HASH_LENGTH);
        const keepStart = Math.floor((MAX_SAFE_LENGTH - FALLBACK_HASH_LENGTH - 5) * 0.6);
        const keepEnd = Math.floor((MAX_SAFE_LENGTH - FALLBACK_HASH_LENGTH - 5) * 0.4);

        const start = name.slice(0, keepStart);
        const end = name.slice(-keepEnd);

        name = `${start}...${end}-${hash}`;
    }

    return name;
};

/**
 * Incase the collection name has the same year as that of the collection year, then avoid appending that.
 * This is useful while importing from an existing library- so it does not duplicate the year path.
 * @param {*} collectionName
 * @param {*} year
 * @returns
 */
const trimCollectionNameWithSameYear = (collectionName = '', year = '') => {
    if (collectionName.indexOf(`${year}-`) === 0) {
        return collectionName.replace(`${year}-`, '');
    }
    return collectionName;
};

module.exports = {
    createCollectionName,
    trimCollectionNameWithSameYear,
};
