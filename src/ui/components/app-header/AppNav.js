import React, { useEffect } from 'react';
import IconButton from '../../components/core-components/icon-button/IconButton';
import style from './AppHeader.css';
import PlayerModeControl from './PlayerModeControl';
import { useApplicationContext, applicationViewStates } from '../../contexts/app.context';
import applicationEvents from '__events/applicationEvents';
import applicationMenuEvents from '__events/applicationMenuEvents';
import { registerAccKeyListener, unregisterAccKeyListener } from '__utils/acceleratorKeysListenerRegistry';

const AppNav = () => {
    const [stateContext, dispatchContext] = useApplicationContext();

    const onNavigationClick = (navTarget) => {
        dispatchContext({ type: applicationEvents.CHANGE_APPLICATION_VIEW, payload: navTarget });
        if (navTarget !== applicationViewStates.PLAYER_VIEW) {
            window.api.setApplicationSettings('currentApplicationView', navTarget);
        }
    };

    const showPlayerModeControl =
        stateContext.currentApplicationView !== applicationViewStates.PLAYER_VIEW &&
        stateContext.currentPlaybackVideo !== undefined;

    useEffect(() => {
        registerAccKeyListener(applicationMenuEvents.OPEN_SETTINGS, () => {
            onNavigationClick(applicationViewStates.SETTINGS_VIEW);
        });
        registerAccKeyListener(applicationMenuEvents.GOTO_PLAYLISTS_VIEW, () => {
            onNavigationClick(applicationViewStates.PLAYLISTS_DASHBOARD_VIEW);
        });
        registerAccKeyListener(applicationMenuEvents.GOTO_COLLECTIONS_VIEW, () => {
            onNavigationClick(applicationViewStates.COLLECTIONS_VIEW);
        });
        return () => {
            unregisterAccKeyListener(applicationMenuEvents.OPEN_SETTINGS);
            unregisterAccKeyListener(applicationMenuEvents.GOTO_PLAYLISTS_VIEW);
            unregisterAccKeyListener(applicationMenuEvents.GOTO_COLLECTIONS_VIEW);
        };
    }, []);

    return (
        <div className={style.appNav}>
            {showPlayerModeControl && (
                <PlayerModeControl onTitleClick={() => onNavigationClick(applicationViewStates.PLAYER_VIEW)} />
            )}
            <IconButton
                title={'Playlist dashboard'}
                isSelected={stateContext.currentApplicationView === applicationViewStates.PLAYLISTS_DASHBOARD_VIEW}
                icon={'dashboard'}
                onClick={() => onNavigationClick(applicationViewStates.PLAYLISTS_DASHBOARD_VIEW)}
            />
            <IconButton
                title={'Browse and manage all videos'}
                isSelected={stateContext.currentApplicationView === applicationViewStates.COLLECTIONS_VIEW}
                icon={'collectionBrowser'}
                onClick={() => onNavigationClick(applicationViewStates.COLLECTIONS_VIEW)}
            />
            <IconButton
                title={'Settings'}
                isSelected={stateContext.currentApplicationView === applicationViewStates.SETTINGS_VIEW}
                icon={'settings'}
                onClick={() => onNavigationClick(applicationViewStates.SETTINGS_VIEW)}
            />
        </div>
    );
};
export default AppNav;
