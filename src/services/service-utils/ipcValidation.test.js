const fs = require('fs');
const os = require('os');
const path = require('path');
const mediaTypes = require('../../constants/mediaTypes');
const {
    isNonEmptyString,
    isValidMediaType,
    isValidSubjectCandidateType,
    isValidFileName,
    isAbsoluteExistingDirectory,
    validateMediaId,
    validateMediaList,
    validateUserPreferenceUpdate,
    validateApplicationSettingUpdate,
    validateRenameMediaArgs,
    validateBulkMediaArgs,
    validateWatchFolderRemoveArgs,
    validateTheme,
    validateMediaOperationArgs,
    validateSubjectCandidateType,
    validateMediaDescription,
    validateLocationName,
    validateLocationRadius,
} = require('./ipcValidation');

describe('ipcValidation', () => {
    describe('isNonEmptyString', () => {
        test('accepts strings with non-whitespace content', () => {
            expect(isNonEmptyString('abc')).toBe(true);
            expect(isNonEmptyString(' abc ')).toBe(true);
        });

        test('rejects empty, whitespace-only, and non-string values', () => {
            expect(isNonEmptyString('')).toBe(false);
            expect(isNonEmptyString('   ')).toBe(false);
            expect(isNonEmptyString(null)).toBe(false);
            expect(isNonEmptyString(123)).toBe(false);
        });
    });

    describe('media and candidate type validation', () => {
        test('validates supported media types', () => {
            expect(isValidMediaType(mediaTypes.VIDEO)).toBe(true);
            expect(isValidMediaType(mediaTypes.IMAGE)).toBe(true);
            expect(isValidMediaType(mediaTypes.AUDIO)).toBe(true);
            expect(isValidMediaType('unsupported')).toBe(false);
        });

        test('validates subject candidate types', () => {
            expect(isValidSubjectCandidateType('pending')).toBe(true);
            expect(isValidSubjectCandidateType('identified')).toBe(true);
            expect(isValidSubjectCandidateType('unknown')).toBe(false);
        });
    });

    describe('isValidFileName', () => {
        test('accepts plain file names', () => {
            expect(isValidFileName('photo.jpg')).toBe(true);
            expect(isValidFileName('my photo.final.jpg')).toBe(true);
        });

        test('rejects empty values and paths', () => {
            expect(isValidFileName('')).toBe(false);
            expect(isValidFileName('   ')).toBe(false);
            expect(isValidFileName(null)).toBe(false);
            expect(isValidFileName('../photo.jpg')).toBe(false);
            expect(isValidFileName('folder/photo.jpg')).toBe(false);
            expect(isValidFileName('folder\\photo.jpg')).toBe(false);
        });
    });

    describe('isAbsoluteExistingDirectory', () => {
        let tempDir;

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-validation-'));
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
            jest.restoreAllMocks();
        });

        test('returns true only for an absolute existing directory', () => {
            const filePath = path.join(tempDir, 'file.txt');
            fs.writeFileSync(filePath, 'content');

            expect(isAbsoluteExistingDirectory(tempDir)).toBe(true);
            expect(isAbsoluteExistingDirectory('relative/path')).toBe(false);
            expect(isAbsoluteExistingDirectory(path.join(tempDir, 'missing'))).toBe(false);
            expect(isAbsoluteExistingDirectory(filePath)).toBe(false);
        });

        test('returns false when statSync throws', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'statSync').mockImplementation(() => {
                throw new Error('stat failed');
            });

            expect(isAbsoluteExistingDirectory(tempDir)).toBe(false);
        });
    });

    describe('media id and list validation', () => {
        test('validates media ids', () => {
            expect(validateMediaId('media-1')).toBe(true);
            expect(validateMediaId('')).toBe(false);
            expect(validateMediaId('   ')).toBe(false);
            expect(validateMediaId(123)).toBe(false);
        });

        test('validates media lists', () => {
            expect(
                validateMediaList([
                    { id: 'video-1', mediaType: mediaTypes.VIDEO },
                    { id: 'image-1', mediaType: mediaTypes.IMAGE },
                ]),
            ).toBe(true);
            expect(validateMediaList([])).toBe(true);
            expect(validateMediaList('not-array')).toBe(false);
            expect(validateMediaList([null])).toBe(false);
            expect(validateMediaList([{ id: '', mediaType: mediaTypes.VIDEO }])).toBe(false);
            expect(validateMediaList([{ id: 'video-1', mediaType: 'bad' }])).toBe(false);
        });
    });

    describe('preference and setting validation', () => {
        test('validates user preference updates', () => {
            expect(validateUserPreferenceUpdate('theme', 'dark')).toBe(null);
            expect(validateUserPreferenceUpdate('hideHiddenCollections', true)).toBe(null);
            expect(validateUserPreferenceUpdate('lastUsedLibraryPaths', ['/tmp/library'])).toBe(null);
            expect(validateUserPreferenceUpdate('viewPreference', { layout: 'grid' })).toBe(null);
            expect(validateUserPreferenceUpdate('unknown', true)).toEqual({
                status: 'error',
                message: 'Unsupported user preference key: unknown',
            });
            expect(validateUserPreferenceUpdate('theme', 'blue')).toEqual({
                status: 'error',
                message: 'Invalid value for user preference key: theme',
            });
        });

        test('validates application setting updates', () => {
            expect(validateApplicationSettingUpdate('currentApplicationView', 'library')).toBe(null);
            expect(validateApplicationSettingUpdate('videoDetailsPanel_width', 300)).toBe(null);
            expect(validateApplicationSettingUpdate('isPlaylistAutoPlay', false)).toBe(null);
            expect(validateApplicationSettingUpdate('lastBrowserState', { route: '/' })).toBe(null);
            expect(validateApplicationSettingUpdate('unknown', true)).toEqual({
                status: 'error',
                message: 'Unsupported application setting key: unknown',
            });
            expect(validateApplicationSettingUpdate('videoDetailsPanel_width', 300.5)).toEqual({
                status: 'error',
                message: 'Invalid value for application setting key: videoDetailsPanel_width',
            });
            expect(validateApplicationSettingUpdate('lastBrowserState', [])).toEqual({
                status: 'error',
                message: 'Invalid value for application setting key: lastBrowserState',
            });
        });
    });

    describe('operation validators', () => {
        test('validates media operation args', () => {
            expect(validateMediaOperationArgs(mediaTypes.VIDEO, 'video-1')).toBe(null);
            expect(validateMediaOperationArgs('bad', 'video-1')).toEqual({
                status: 'error',
                message: 'Unsupported media type: bad',
            });
            expect(validateMediaOperationArgs(mediaTypes.VIDEO, '')).toEqual({
                status: 'error',
                message: 'Invalid media id provided',
            });
        });

        test('validates rename media args', () => {
            expect(validateRenameMediaArgs(mediaTypes.VIDEO, 'video-1', 'old.mp4', 'new.mp4')).toBe(null);
            expect(validateRenameMediaArgs('bad', 'video-1', 'old.mp4', 'new.mp4')).toEqual({
                status: 'error',
                message: 'Unsupported media type: bad',
            });
            expect(validateRenameMediaArgs(mediaTypes.VIDEO, 'video-1', '../old.mp4', 'new.mp4')).toEqual({
                status: 'error',
                message: 'Invalid file name provided for rename operation',
            });
            expect(validateRenameMediaArgs(mediaTypes.VIDEO, 'video-1', 'old.mp4', 'folder/new.mp4')).toEqual({
                status: 'error',
                message: 'Invalid file name provided for rename operation',
            });
        });

        test('validates bulk media args', () => {
            expect(validateBulkMediaArgs([{ id: 'video-1', mediaType: mediaTypes.VIDEO }])).toBe(null);
            expect(validateBulkMediaArgs([{ id: '', mediaType: mediaTypes.VIDEO }])).toEqual({
                status: 'error',
                message: 'Invalid media list provided',
            });
        });

        test('validates watch folder remove args', () => {
            expect(validateWatchFolderRemoveArgs('media-1', 'watch-folder-1', 'user')).toBe(null);
            expect(validateWatchFolderRemoveArgs('', 'watch-folder-1', 'user')).toEqual({
                status: 'error',
                message: 'Invalid watch folder remove payload provided',
            });
            expect(validateWatchFolderRemoveArgs('media-1', '', 'user')).toEqual({
                status: 'error',
                message: 'Invalid watch folder remove payload provided',
            });
            expect(validateWatchFolderRemoveArgs('media-1', 'watch-folder-1', '')).toEqual({
                status: 'error',
                message: 'Invalid watch folder remove payload provided',
            });
        });
    });

    describe('explicit value validators', () => {
        test('validates themes', () => {
            expect(validateTheme('light')).toBe(null);
            expect(validateTheme('dark')).toBe(null);
            expect(validateTheme('system')).toBe(null);
            expect(validateTheme('blue')).toEqual({ status: 'error', message: 'Invalid theme value: blue' });
        });

        test('validates subject candidate type errors', () => {
            expect(validateSubjectCandidateType('pending')).toBe(null);
            expect(validateSubjectCandidateType('identified')).toBe(null);
            expect(validateSubjectCandidateType('bad')).toEqual({
                status: 'error',
                message: 'Invalid subject candidate type. Expected "pending" or "identified".',
            });
        });

        test('validates media description boundaries', () => {
            expect(validateMediaDescription('Valid description')).toBe(null);
            expect(validateMediaDescription('a'.repeat(1000))).toBe(null);
            expect(validateMediaDescription('')).toEqual({ status: 'error', message: 'Invalid media description provided' });
            expect(validateMediaDescription('   ')).toEqual({ status: 'error', message: 'Invalid media description provided' });
            expect(validateMediaDescription('a'.repeat(1001))).toEqual({
                status: 'error',
                message: 'Invalid media description provided',
            });
        });

        test('validates location name boundaries', () => {
            expect(validateLocationName('Home')).toBe(null);
            expect(validateLocationName('a'.repeat(300))).toBe(null);
            expect(validateLocationName('')).toEqual({ status: 'error', message: 'Invalid location name' });
            expect(validateLocationName('   ')).toEqual({ status: 'error', message: 'Invalid location name' });
            expect(validateLocationName('a'.repeat(301))).toEqual({ status: 'error', message: 'Invalid location name' });
        });

        test('validates location radius boundaries', () => {
            expect(validateLocationRadius(0)).toBe(null);
            expect(validateLocationRadius(5000)).toBe(null);
            expect(validateLocationRadius(-1)).toEqual({ status: 'error', message: 'Invalid location radius value' });
            expect(validateLocationRadius(5001)).toEqual({ status: 'error', message: 'Invalid location radius value' });
        });
    });
});
