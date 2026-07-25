import React, { useEffect, useState } from 'react';
import ReactDom from 'react-dom/client';
import './styles/theme.css';
import './styles/app.css';
import './styles/utils.css';
import AppHeader from '__components/app-header/AppHeader';
import Settings from './views/settings/Settings';
import Dashboard from './views/dashboard/Dashboard';

import { ApplicationContext, applicationViewStates, useApplicationContext } from '__contexts/app.context';
import AppNotificationProvider, { showGlobalError } from '__contexts/AppNotificationContext';
import applicationEvents from '__events/applicationEvents';
import Player from './views/player/Player';
import mainThreadEvents from '__events/mainThreadEvents';
import AppFreezer from '__components/core-components/app-freezer/AppFreezer';
import AppStatusMessage from '__components/core-components/app-status-message/AppStatusMessage';
import AppNotification from '__components/core-components/app-notification/AppNotification';
import WelcomeMessage from '__components/welcome-message/WelcomeMessage';
import applicationMenuEvents from '__events/applicationMenuEvents';
import AllCollections from './views/all-collections/AllCollections';
import ipcChannels from '__constants/ipcChannels';

const getCurrentView = (stateContext) => {
    switch (stateContext.currentApplicationView) {
        case applicationViewStates.SETTINGS_VIEW:
            return <Settings />;
        case applicationViewStates.PLAYLISTS_DASHBOARD_VIEW:
            return <Dashboard />;
        case applicationViewStates.COLLECTIONS_VIEW:
            return <AllCollections />;
        case applicationViewStates.PLAYER_VIEW:
            return <Player />;
    }
};

const ApplicationContent = () => {
    const [stateContext, dispatchContext] = useApplicationContext();

    useEffect(() => {
        const notifyRendererHandler = (message) => {
            switch (message.event) {
                case mainThreadEvents.ON_PLAYLIST_UPDATE: {
                    dispatchContext({ type: mainThreadEvents.ON_PLAYLIST_UPDATE, payload: message.payload });
                    break;
                }
                case mainThreadEvents.ON_TAGS_UPDATE: {
                    dispatchContext({ type: mainThreadEvents.ON_TAGS_UPDATE, payload: message.payload });
                    break;
                }
                case applicationEvents.COLLECTIONS_UPDATE: {
                    dispatchContext({ type: applicationEvents.COLLECTIONS_UPDATE, payload: message.payload });
                    break;
                }

                case mainThreadEvents.ON_NEW_LIBRARY_SELECTION_COMPLETE: {
                    dispatchContext({
                        type: mainThreadEvents.ON_NEW_LIBRARY_SELECTION_COMPLETE,
                    });
                    break;
                }
                default:
                    break;
            }
        };

        const applicationMenuHandler = (command) => {
            if (command === applicationMenuEvents.TOGGLE_HIDDEN_COLLECTIONS) {
                window.api.getUserPreference('hideHiddenCollections').then((hideHiddenCollections) => {
                    window.api.setUserPreference('hideHiddenCollections', !Boolean(hideHiddenCollections)).then((updatedPreferences) => {
                        dispatchContext({
                            type: applicationEvents.USER_PREFERENCE_UPDATE,
                            payload: {
                                userPreferences: updatedPreferences,
                            },
                        });
                    });
                });
            }
        };

        window.api.receive(ipcChannels.NOTIFY_RENDERER_PROCESS, notifyRendererHandler);
        window.api.receive(ipcChannels.APPLICATION_MENU_ACTION, applicationMenuHandler);

        return () => {
            window.api.stop(ipcChannels.NOTIFY_RENDERER_PROCESS, notifyRendererHandler);
            window.api.stop(ipcChannels.APPLICATION_MENU_ACTION, applicationMenuHandler);
        };
    }, []);

    return getCurrentView(stateContext);
};

const unInitializedApplicationState = {
    currentApplicationView: applicationViewStates.COLLECTIONS_VIEW,
    currentPlaylist: null,
    hideHiddenCollections: false,
    appStatus: {
        freezeApp: false,
        message: '',
    },
};

const Freezer = ({ children }) => {
    return (
        <div className="freezer">
            <div className="center">
                <div className="freezerMessage">{children}</div>
            </div>
        </div>
    );
};

const App = () => {
    const [isApplicationLoading, setIsApplicationLoading] = useState(true);
    const [isImportInProgress, setIsImportInProgress] = useState(false);
    const [applicationState, setInitialApplicationState] = useState(unInitializedApplicationState);
    const [importProgressStatus, setImportProgressStatus] = useState('');
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);

    /**
     * listen to all incoming events from main thread
     */
    useEffect(() => {
        const notifyRendererHandler = (message) => {
            switch (message.event) {
                case mainThreadEvents.ON_LIBRARY_PATH_NOT_FOUND: {
                    setIsApplicationLoading(true);
                    setShowWelcomeMessage(true);
                    break;
                }
                case mainThreadEvents.ON_SUCCESSFUL_INIT:
                case mainThreadEvents.ON_NEW_LIBRARY_SELECTION_COMPLETE: {
                    if (message.payload.userPreferences.libraryRootPath !== '') {
                        window.api.getApplicationSettings('currentApplicationView').then((data) => {
                            setInitialApplicationState({
                                ...unInitializedApplicationState,
                                ...message.payload,
                                ...{
                                    currentApplicationView: data || unInitializedApplicationState.currentApplicationView,
                                },
                            });
                            setShowWelcomeMessage(false);
                            setIsApplicationLoading(false);
                            setIsImportInProgress(false);

                            if (message.payload.importWarning) {
                                showGlobalError(`Some files could not be imported: ${message.payload.importWarning}`);
                            }
                        });
                    } else {
                        setInitialApplicationState(unInitializedApplicationState);
                    }

                    break;
                }
                case mainThreadEvents.ON_IMPORT_PROGRESS: {
                    setImportProgressStatus(message.payload.message);
                    setIsImportInProgress(true);
                    setShowWelcomeMessage(false);
                    break;
                }
                case mainThreadEvents.ON_IMPORT_FAILURE: {
                    setIsImportInProgress(false);
                    setShowWelcomeMessage(false);
                    showGlobalError(message.payload?.errorDetails || 'Import failed. Please check the error log and try again.');
                    break;
                }
                case 'serverError': {
                    showGlobalError('Server error occurred. Please try again later.');
                    break;
                }
                default:
                    break;
            }
        };

        const zoomFactorChangeHandler = (zoomFactor) => {
            document.documentElement.style.setProperty('--zoom-factor', zoomFactor);
        };

        window.api.receive(ipcChannels.NOTIFY_RENDERER_PROCESS, notifyRendererHandler);
        window.api.receive(ipcChannels.ZOOM_FACTOR_CHANGE_ACTION, zoomFactorChangeHandler);

        return () => {
            window.api.stop(ipcChannels.NOTIFY_RENDERER_PROCESS, notifyRendererHandler);
            window.api.stop(ipcChannels.ZOOM_FACTOR_CHANGE_ACTION, zoomFactorChangeHandler);
        };
    }, []);

    return (
        <>
            {!isApplicationLoading && (
                <>
                    {/* Main application context and view rendering */}
                    <ApplicationContext initialState={applicationState}>
                        <AppHeader />
                        <ApplicationContent />
                        <AppFreezer />
                        <AppStatusMessage />
                    </ApplicationContext>
                </>
            )}

            {/* Spalash screens, application freezers */}
            {showWelcomeMessage && <WelcomeMessage />}
            {isApplicationLoading && <Freezer>Loading Melvec...</Freezer>}
            {isImportInProgress && (
                <Freezer>
                    <>
                        <div>
                            <h2>Import is in progress.</h2>
                            <div className="secondaryInfo mt5">Please do not close the app.</div>
                        </div>
                        <div className="mt15">{importProgressStatus}</div>
                    </>
                </Freezer>
            )}
            {/* global notification system */}
            <AppNotificationProvider>
                <AppNotification />
            </AppNotificationProvider>
        </>
    );
};

const root = ReactDom.createRoot(document.getElementById('app'));
root.render(<App />);
