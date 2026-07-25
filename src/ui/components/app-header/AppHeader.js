import React from 'react';
import Logo from './Logo';
import GlobalSearch from './global-search/GlobalSearch';
import AppNav from './AppNav';
import styles from './AppHeader.css';
import { applicationViewStates, useApplicationContext } from '../../contexts/app.context';
import ipcChannels from '__constants/ipcChannels';

const AppHeader = () => {
    const [stateContext] = useApplicationContext();
    const maximizeApp = () => {
        window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, { event: 'maximizeWindow' });
    };
    return (
        <>
            <div className={styles.appHeader}>
                <div className={styles.windowControls} onDoubleClick={() => maximizeApp()}></div>
                <div className={styles.leftContent}>
                    <Logo />
                </div>

                {stateContext.currentApplicationView !== applicationViewStates.SETTINGS_VIEW && <GlobalSearch />}
                <div className={styles.rightContent}>
                    <AppNav />
                </div>
            </div>
        </>
    );
};

export default AppHeader;
