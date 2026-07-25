import React from 'react';
import styles from './AppHeader.css';
import IconButton from '../../components/core-components/icon-button/IconButton';
import { useApplicationContext } from '__contexts/app.context';

const PlayerModeControl = ({ onTitleClick = null }) => {
    const [stateContext] = useApplicationContext();

    return (
        <div className={styles.playerModeControl}>
            <IconButton icon="play" onClick={() => onTitleClick()} />
            <span className={styles.currentVideoTitle} onClick={() => onTitleClick()}>
                {stateContext.currentPlaybackVideo.name}
            </span>
        </div>
    );
};

export default PlayerModeControl;
