import React from 'react';
import formStyles from '__styles/forms.css';
import AsyncButton from '__components/core-components/button/AsyncButton';
import {
    HeaderControlBar,
    HeaderControlBarRight,
    HeaderControlBarLeft,
} from '__components/core-components/header-control-bar/HeaderControlBar';
import {
    ContextualActionButton,
    ContextualActionControl,
} from '__components/core-components/contextual-action-control/ContextualActionControl';
import useBackupActions from './useBackupActions';
import ExportVideos from './ExportVideos';

const BackupSettings = () => {
    const {
        exportAllMetaState,
        setExportAllMetaState,
        backupDatabaseState,
        setBackupDatabaseState,
        importAllMetadataState,
        setImportAllMetadataState,
        importDatabaseState,
        setImportDatabaseState,
        startAllMetaDataBackup,
        startImportAllMetaData,
        openDatabaseBackupFolder,
        startImportingDatabase,
        resetAllData,
    } = useBackupActions();

    const exportAllMetaStateLabels = {
        default: 'Export all meta data',
        progress: 'Exporting all meta data...',
        success: 'Export completed',
        error: 'Error!!! Try again',
    };

    const importAllMetadataStateLabels = {
        default: 'Import all metadata',
        progress: 'Importing all metadata...',
        success: 'Import completed',
        error: 'Error!!! Try again',
    };
    const backupDatabaseStateLabels = {
        default: 'Backup database',
        progress: 'Backuping all data...',
        success: 'Backup completed',
        error: 'Error!!! Try again',
    };
    const importDatabaseStateLabels = {
        default: 'Import database',
        progress: 'Importing database...',
        success: 'Import completed',
        error: 'Error!!! Try again',
    };

    return (
        <div>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3>Backup and restore</h3>
                </HeaderControlBarLeft>
                <HeaderControlBarRight>
                    <ContextualActionControl>
                        <ContextualActionButton onClick={() => resetAllData()}>Reset all meta data</ContextualActionButton>
                    </ContextualActionControl>
                </HeaderControlBarRight>
            </HeaderControlBar>
            <div>
                <h4>Export all meta data.</h4>
                <p>
                    This creates backup for meta informations like playlists, tags, titles, star rating, content quality, views count for
                    all of your videos. This is helpful if you loose your library and re-import, re-initialize with different collections.
                </p>
                <div className={formStyles.formInputWrapper}>
                    <AsyncButton
                        state={exportAllMetaState}
                        labels={exportAllMetaStateLabels}
                        onClick={startAllMetaDataBackup}
                        onReset={() => setExportAllMetaState('default')}
                    />
                </div>
                <div className={formStyles.formInputWrapper}>
                    <AsyncButton
                        state={importAllMetadataState}
                        labels={importAllMetadataStateLabels}
                        onClick={startImportAllMetaData}
                        onReset={() => setImportAllMetadataState('default')}
                    />
                </div>
                <div className="mt15">
                    <h4>Take a backup of your database.</h4>
                    <div className={formStyles.formInputWrapper}>
                        <AsyncButton
                            state={backupDatabaseState}
                            labels={backupDatabaseStateLabels}
                            onClick={openDatabaseBackupFolder}
                            onReset={() => setBackupDatabaseState('default')}
                        />
                    </div>
                </div>

                <div className={formStyles.formInputWrapper}>
                    <AsyncButton
                        state={importDatabaseState}
                        labels={importDatabaseStateLabels}
                        onClick={startImportingDatabase}
                        onReset={() => setImportDatabaseState('default')}
                    />
                </div>

                <p>
                    <strong>Note:</strong> Do not jump to another section of this app while backup is in progress
                </p>
            </div>
            <hr />
            <ExportVideos></ExportVideos>
        </div>
    );
};

export default BackupSettings;
