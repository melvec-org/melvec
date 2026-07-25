
import validateNewPlaylistName from './validateNewPlaylistName';

// Mock constraints for predictable test results
jest.mock('../configs/constraints', () => ({
    PLAYLIST_LABEL_MIN_LENGTH: 2,
    PLAYLIST_LABEL_MAX_LENGTH: 50,
    PLAYLIST_LABEL_REGX: /^[\sa-zA-Z0-9_.-]{2,50}$/,
}));

describe('validateNewPlaylistName', () => {
    test('should return error if playlist name is a duplicate (case-insensitive)', () => {
        const playlists = [{ label: 'My Playlist' }];
        const result = validateNewPlaylistName('my playlist', playlists);
        expect(result).toEqual({
            error: 'Playlist name already exists',
            isValid: false,
        });
    });

    test('should return error if playlist name is shorter than min length', () => {
        const result = validateNewPlaylistName('a', []);
        expect(result).toEqual({
            error: 'Playlist name should be between 2 and 50 characters long',
            isValid: false,
        });
    });

    test('should return error if playlist name is longer than max length', () => {
        const longName = 'a'.repeat(51);
        const result = validateNewPlaylistName(longName, []);
        expect(result).toEqual({
            error: 'Playlist name should be between 2 and 50 characters long',
            isValid: false,
        });
    });

    test('should return error if playlist name contains invalid characters', () => {
        const result = validateNewPlaylistName('Invalid@Name', []);
        expect(result).toEqual({
            error: 'Playlist name should only contain alphanumeric characters, space, hyphens and underscores',
            isValid: false,
        });
    });

    test('should return isValid=true if playlist name meets all requirements', () => {
        const result = validateNewPlaylistName('Valid_Name-123', []);
        expect(result).toEqual({
            error: '',
            isValid: true,
        });
    });

    test('should trim spaces before validation', () => {
        const result = validateNewPlaylistName('   Valid Name   ', []);
        expect(result).toEqual({
            error: '',
            isValid: true,
        });
    });

    test('should allow spaces inside playlist name', () => {
        const result = validateNewPlaylistName('My Playlist Name', []);
        expect(result.isValid).toBe(true);
        expect(result.error).toBe('');
    });
});
