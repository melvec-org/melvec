import React from 'react';
import styles from './AppFreezer.css';
import { useApplicationContext } from '__contexts/app.context';

const AppFreezer = () => {
    const [stateContext] = useApplicationContext();

    if (stateContext.appStatus.freezeApp) {
        return <div className={styles.appFreezer} onClick={() => {}} />;
    } else {
        return null; // Don't render the component if the app is not frozen.
    }
};

export default AppFreezer;
