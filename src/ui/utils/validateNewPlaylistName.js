import { PLAYLIST_LABEL_MAX_LENGTH, PLAYLIST_LABEL_MIN_LENGTH, PLAYLIST_LABEL_REGX } from '../configs/constraints';

const validateNewPlaylistName = (playlistName = '', playlists = []) => {
    const playlistNameInLowerCase = playlistName.trim().toLowerCase();

    const isDuplicate = playlists.some((item) => item.label.toLowerCase() === playlistNameInLowerCase);
    if (isDuplicate) {
        return {
            error: 'Playlist name already exists',
            isValid: false,
        };
    }
    if (
        playlistNameInLowerCase.length < PLAYLIST_LABEL_MIN_LENGTH ||
        playlistNameInLowerCase.length > PLAYLIST_LABEL_MAX_LENGTH
    ) {
        return {
            error: 'Playlist name should be between 2 and 50 characters long',
            isValid: false,
        };
    }
    if (!PLAYLIST_LABEL_REGX.test(playlistNameInLowerCase)) {
        return {
            error: 'Playlist name should only contain alphanumeric characters, space, hyphens and underscores',
            isValid: false,
        };
    }
    return {
        error: '',
        isValid: true,
    };
};

export default validateNewPlaylistName;
