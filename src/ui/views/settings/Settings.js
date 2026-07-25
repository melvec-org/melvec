import React, { useEffect, useState } from 'react';
import styles from './Settings.css';
import GeneralSettings from './general-preferences/GeneralSettings';
import Tabs from '../../components/core-components/tabs/Tabs';
import TagSettings from './tag-settings/TagSettings';
import PlaylistSettings from './playlist-settings/PlaylistSettings';
import CollectionSettings from './collection-settings/CollectionSettings';
import AdvancedSettings from './advanced-settings/AdvancedSettings';
import BackupSettings from './backup-settings/BackupSettings';
import Extras from './extras/Extras';
import DisplaySettings from './display-settings/DisplaySettings';

let tabsSettings = [
    {
        header: 'General',
        component: <GeneralSettings />,
    },
    {
        header: 'Display',
        component: <DisplaySettings />,
    },
    {
        header: 'Collections',
        component: <CollectionSettings />,
    },
    {
        header: 'Tags',
        component: <TagSettings />,
    },
    {
        header: 'Playlists',
        component: <PlaylistSettings />,
    },
    {
        header: 'Backup',
        component: <BackupSettings />,
    },
    {
        header: 'Advanced',
        component: <AdvancedSettings />,
    },
    {
        header: 'Extras',
        component: <Extras />,
    },
];

const Settings = () => {
    const [tabIndex, setTabIndex] = useState(0);

    const onSettingsTabChange = (index) => {
        window.api.setApplicationSettings('currentSettingsTabIndex', index);
    };

    useEffect(() => {
        window.api.getApplicationSettings('currentSettingsTabIndex').then((data) => {
            setTabIndex(data || 0);
        });
    }, []);
    return (
        <div className={styles.settings}>
            <div className={styles.settingsContainer}>
                <Tabs settings={tabsSettings} selectedTabIndex={tabIndex} onTabIndexChange={onSettingsTabChange}></Tabs>
            </div>
        </div>
    );
};

export default Settings;
