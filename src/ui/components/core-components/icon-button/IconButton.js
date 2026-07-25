import React from 'react';
import CloseIcon from '../icons/CloseIcon';
import style from './IconButton.css';
import AddIcon from '../icons/AddIcon';
import SettingsIcon from '../icons/SettingsIcon';
import DashboardIcon from '../icons/DashboardIcon';
import GridListIcon from '../icons/GridListIcon';
import SuffleIcon from '../icons/SuffleIcon';
import RepeatPlayIcon from '../icons/RepeatPlayIcon';
import AutoPlayIcon from '../icons/AutoPlayIcon';
import CollectionBrowwerIcon from '../icons/CollectionBrowserIcon';
import InfoIcon from '../icons/InfoIcon';
import AiIcon from '../icons/aiIcon';

const icons = {
    edit: <span>✎</span>,
    close: <CloseIcon />,
    add: <AddIcon />,
    settings: <SettingsIcon />,
    dashboard: <DashboardIcon />,
    gridList: <GridListIcon />,
    collectionBrowser: <CollectionBrowwerIcon />,
    listView: <span>☰</span>,
    gridView: <span>☷</span>,
    play: <span>▷</span>,
    pause: <span>∥</span>,
    check: <span>✓</span>,
    shuffle: <SuffleIcon />,
    autoPlay: <AutoPlayIcon />,
    repeatPlay: <RepeatPlayIcon />,
    info: <InfoIcon />,
    ai: <AiIcon />,
    expand: <span>⛶</span>,
};

const IconButton = React.forwardRef(
    ({ icon, _classes = '', onClick, isSelected = false, title = '', tabIndex = 0, isfocused = 'false', onKeyDown, ...props }, ref) => {
        const buttonClass = `${style.iconButton} ${_classes} ${isSelected ? style.isSelected : ''}`;

        return (
            <button
                ref={ref}
                className={buttonClass}
                onClick={onClick}
                title={title}
                tabIndex={tabIndex}
                isfocused={isfocused}
                onKeyDown={onKeyDown}
                {...props} // ← This allows aria-label, data-*, etc.
            >
                {icons[icon]}
            </button>
        );
    },
);

export default IconButton;
