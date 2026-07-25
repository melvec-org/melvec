import React, { useContext, createContext, useReducer, useEffect } from 'react';
import mainThreadEvents from '__events/mainThreadEvents';
import applicationEvents from '__events/applicationEvents';

const StateContext = createContext();
const DispatchContext = createContext();

export const applicationViewStates = {
    SETTINGS_VIEW: 'showSettingsWindow',
    COLLECTIONS_VIEW: 'showAllCollectionsWindow',
    PLAYLISTS_DASHBOARD_VIEW: 'showAllPlaylistsWindow',
    PLAYER_VIEW: 'show-player-view',
};

export const userPreferences = {
    libraryRootFolder: 'null',
    watchFolder: 'null',
};

/**
 * Here is the sample structure
 * {
 *  collections : [],
 *  currentApplicationView: '',
 *  currentPlaylist: [],
 *  playlists: [],
 *
 *  currentBrowserState: {
 *      selectedCollection: null,
 *      selectedVideoId: null
 *  },
 *  tags : [],
 *  userPreference: {
 *      libraryRootPath,
 *      watchFolderPath,
 *  },
 *  appStatus : {
 *      freezeApp: false,
 *      message: ''
 *  },
 *  playback: {
 *      isPlaying: false
 *      currentVideoDetails: {},
 *  }
 *
 * }
 *
 *
 * @param state
 * @param action
 * @returns {
 *  (*&{userPreferences: *})|(*&{currentPlaybackVideo: *, currentPlaylist: (null|*), currentApplicationView: string})|(*&{currentApplicationView})|(*&{currentPlaybackVideo})|*}
 */

const applicationContextReducer = (state, action) => {
    switch (action.type) {
        case 'appLibraryChange': {
            // reset the whole object as library has changed
            return action.payload;
        }

        case applicationEvents.CHANGE_APPLICATION_VIEW:
            return { ...state, currentApplicationView: action.payload };
        case applicationEvents.PLAY_VIDEO:
            return { ...state, currentPlaybackVideo: action.payload };
        case applicationEvents.PLAY_VIDEO_FROM_PLAYLIST:
            return {
                ...state,
                currentPlaybackVideo: action.payload.currentPlayItem,
                currentPlaylist: action.payload.currentPlaylist,
                currentPlaylistName: action.payload.currentPlaylistName,
                currentApplicationView: applicationViewStates.PLAYER_VIEW,
            };
        case applicationEvents.USER_PREFERENCE_UPDATE:
            return {
                ...state,
                userPreferences: action.payload?.userPreferences,
            };
        case mainThreadEvents.ON_PLAYLIST_UPDATE:
            return {
                ...state,
                playlists: action.payload.playlists,
            };
        case mainThreadEvents.ON_TAGS_UPDATE:
            return {
                ...state,
                tags: action.payload.tags,
            };
        case applicationEvents.COLLECTIONS_UPDATE:
            return {
                ...state,
                collections: action.payload.collections,
            };

        case applicationEvents.GOTO_COLLECTION: {
            if (action.payload === null) {
                return {
                    ...state,
                    currentBrowserState: null,
                };
            }
            return {
                ...state,
                currentApplicationView: applicationViewStates.COLLECTIONS_VIEW,
                currentBrowserState: {
                    selectedCollection: action.payload.selectedCollection,
                    selectedVideoId: action.payload.selectedVideoId,
                },
            };
        }
        case applicationEvents.GOTO_PLAYLIST: {
            return {
                ...state,
                currentApplicationView: applicationViewStates.PLAYLISTS_DASHBOARD_VIEW,
                currentDashboardState: {
                    selectedPlaylist: action.payload.playlist,
                },
            };
        }
        case applicationEvents.APP_STATUS_UPDATE: {
            let messageAutoHide = false;

            if (action.payload.freezeApp === true || action.payload.messageAutoHide === true) {
                messageAutoHide = true;
            }

            return {
                ...state,
                appStatus: {
                    freezeApp: action.payload.freezeApp || false,
                    message: action.payload.message || '',
                    messageAutoHide: messageAutoHide,
                },
            };
        }
        case mainThreadEvents.ON_NEW_LIBRARY_SELECTION_COMPLETE: {
            return {
                ...state,
                currentApplicationView: applicationViewStates.COLLECTIONS_VIEW,
                appStatus: {
                    freezeApp: false,
                    messageAutoHide: false,
                    message: '',
                },
            };
        }
        case applicationEvents.WATCH_FOLDERS_UPDATE: {
            return {
                ...state,
                watchFolders: action.payload.watchFolders,
            };
        }
    }
};

export const ApplicationContext = ({ children, initialState = {} }) => {
    const [state, dispatch] = useReducer(applicationContextReducer, initialState);

    useEffect(() => {
        // if initialState is changed, refresh the whole settings and application
        dispatch({ type: 'appLibraryChange', payload: initialState });
    }, [initialState]);

    return (
        <DispatchContext.Provider value={dispatch}>
            <StateContext.Provider value={state}>{children}</StateContext.Provider>
        </DispatchContext.Provider>
    );
};

export const useApplicationContext = () => [useContext(StateContext), useContext(DispatchContext)];
