import { useState } from 'react';

import rendererEvents from '__events/rendererEvents';
import mainThreadEvents from '__events/mainThreadEvents';
import ipcChannels from '__constants/ipcChannels';
import { showGlobalNotification } from '__contexts/AppNotificationContext';
import responseStatus from '__constants/responseStatus';

const saveMetaData = (data) => {
    const dateStamp =
        new Date().getFullYear().toString() +
        '_' +
        (new Date().getMonth() + 1).toString() +
        '_' +
        new Date().getDate().toString() +
        '_' +
        new Date().getHours().toString() +
        '_' +
        new Date().getMinutes().toString();

    window.api.send(ipcChannels.DOWNLOAD_FILE, {
        title: 'Save all meta data File',
        fileName: `melvec_meta_data_${dateStamp}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        fileContent: data,
    });
};

const useBackupActions = () => {
    const [exportAllMetaState, setExportAllMetaState] = useState('default');
    const [backupDatabaseState, setBackupDatabaseState] = useState('default');
    const [importAllMetadataState, setImportAllMetadataState] = useState('default');
    const [importDatabaseState, setImportDatabaseState] = useState('default');

    const startAllMetaDataBackup = () => {
        setExportAllMetaState('progress');

        window.api.exportAllMetaData({}).then((data) => {
            if (data.status === responseStatus.SUCCESS) {
                saveMetaData(data.data);
                setExportAllMetaState(responseStatus.SUCCESS);
            } else {
                setExportAllMetaState('error');
                alert(data.message);
            }
        });
    };

    const importAllMetaData = (metaData) => {
        setImportAllMetadataState('progress');
        window.api.importAllMetaData(metaData).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setImportAllMetadataState(responseStatus.SUCCESS);
                showGlobalNotification('Metadata imported successfully.');
            } else {
                setImportAllMetadataState('error');
                alert(response.message);
            }
        });
    };

    const startImportAllMetaData = () => {
        window.api.receiveOnce(ipcChannels.OPEN_FOLDERS_ACTION, (data) => {
            if (data.event === mainThreadEvents.ON_METADATA_IMPORT_FOLDER_SELECTED) {
                if (data.payload !== null) {
                    importAllMetaData(data.payload);
                } else {
                    alert('Please select a metadata file to import.');
                }
            }
        });
        window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, {
            event: rendererEvents.OPEN_METADATA_FILE_TO_IMPORT,
        });
    };

    const onDataBackupResponse = (eventData) => {
        if (eventData.event === mainThreadEvents.ON_DATABASE_BACKUP_COMPLETE) {
            if (eventData.payload.status === responseStatus.SUCCESS) {
                setBackupDatabaseState(responseStatus.SUCCESS);
                showGlobalNotification(`Backup completed successfully`);
            } else {
                setBackupDatabaseState('error');
                alert(eventData.payload.message);
            }
        }
        window.api.stop(ipcChannels.NOTIFY_RENDERER_PROCESS, onDataBackupResponse);
    };

    const startDatabaseBackup = (targetPath) => {
        window.api.receiveOnce(ipcChannels.NOTIFY_RENDERER_PROCESS, onDataBackupResponse);
        window.api.startDatabaseBackup(targetPath).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setBackupDatabaseState(responseStatus.SUCCESS);
            } else {
                setBackupDatabaseState('error');
                alert(response.message);
            }
        });
    };

    const openDatabaseBackupFolder = () => {
        window.api.receiveOnce(ipcChannels.OPEN_FOLDERS_ACTION, (data) => {
            if (data.event === mainThreadEvents.ON_BACKUP_FOLDER_SELECTED) {
                if (data.payload !== null) {
                    startDatabaseBackup(data.payload);
                } else {
                    alert('Please select a folder to take backup.');
                }
            }
        });

        window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, {
            event: rendererEvents.OPEN_BACKUP_FOLDER,
        });
    };

    const onDatabaseImport = (eventData) => {
        if (eventData.event === mainThreadEvents.ON_DATABASE_IMPORT_COMPLETE) {
            if (eventData.payload.status === responseStatus.SUCCESS) {
                setImportDatabaseState(responseStatus.SUCCESS);
                alert('Database imported successfully. Close and reopen the app.');
            } else {
                setImportDatabaseState('error');
                alert(eventData.response.message);
            }
        }
        window.api.stop(ipcChannels.NOTIFY_RENDERER_PROCESS, onDatabaseImport);
    };

    const startImportingDatabase = () => {
        setImportDatabaseState('progress');

        window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, {
            event: rendererEvents.OPEN_DB_TO_IMPORT,
        });

        window.api.receiveOnce(ipcChannels.OPEN_FOLDERS_ACTION, (data) => {
            if (data.event === mainThreadEvents.ON_DB_IMPORT_FILE_SELECTED) {
                if (data.payload !== null) {
                    window.api.receive(ipcChannels.NOTIFY_RENDERER_PROCESS, onDatabaseImport);
                    window.api.importDatabase(data.payload);
                } else {
                    alert('Please select a database file to import.');
                }
            }
        });
    };

    const resetAllData = () => {
        window.confirm(
            'This would delete all the search history, tags, collections, playlist. This action can not be undone. Are you sure you want to proceed?',
        ) &&
            window.api.resetAllMetaData().then((data) => {
                if (data.status === responseStatus.SUCCESS) {
                    alert('All data has been deleted successfully. Please restart the app.');
                } else {
                    alert('Failed to delete all data, try again later');
                }
            });
    };

    return {
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
    };
};

export default useBackupActions;
