// this is a react component
// this has a list that would be visible when there are at least one value selected for the watch folders list
// There should be an input and button to select folders from system
// once we have a list of watchfolders, the list would also alow each item to be removed from the list.

import Button from '__components/core-components/button/Button';
import React, { useEffect, useState } from 'react';
import settingsStyle from '../Settings.css';
import formStyles from '__styles/forms.css';
import IconButton from '__components/core-components/icon-button/IconButton';
import rendererEvents from '__events/rendererEvents';
import mainThreadEvents from '__events/mainThreadEvents';
import getUniqueID from '../../../../services/service-utils/getUniqueID';
import { useApplicationContext } from '__contexts/app.context';
import applicationEvents from '__events/applicationEvents';
import ipcChannels from '__constants/ipcChannels';
import { showGlobalNotification } from '__contexts/AppNotificationContext';
import responseStatus from '__constants/responseStatus';

const WatchFolders = () => {
    const [watchFolders, setWatchFolders] = useState([]);

    const [selectedFolderPath, setSelectedFolderPath] = useState('');
    const [hasFolderSelectionStarted, setHadFolderSelectionStarted] = useState(false);
    const [applicationState, dispatchEvent] = useApplicationContext();
    const [isWatchFolderProcessing, setIsWatchFolderProcessing] = useState(false);

    useEffect(() => {
        window.api.getWatchFolders().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                if (Array.isArray(response.data)) {
                    setWatchFolders(response.data);
                }
            }
        });
    }, []);

    const onFolderSelectionMade = (data) => {
        if (data.event === mainThreadEvents.ON_WATCH_FOLDER_SELECTED) {
            if (data.payload !== null) {
                setSelectedFolderPath(data.payload);
            }
            window.api.stop(ipcChannels.OPEN_FOLDERS_ACTION, onFolderSelectionMade);
            setHadFolderSelectionStarted(false);
        }
    };

    useEffect(() => {
        if (hasFolderSelectionStarted) {
            window.api.receive(ipcChannels.OPEN_FOLDERS_ACTION, onFolderSelectionMade);
        }
    }, [hasFolderSelectionStarted]);

    const handleAddFolder = () => {
        if (selectedFolderPath !== '') {
            const newWatchFolder = {
                id: getUniqueID(),
                path: selectedFolderPath,
                label: selectedFolderPath.split('/').pop(),
            };
            const existingWatchFolder = watchFolders.find((folder) => newWatchFolder.path.indexOf(folder.path) === 0);

            if (existingWatchFolder) {
                alert(`${newWatchFolder.path} already exists in the watch folders or the folder is already being watched.`);
                setSelectedFolderPath('');
                return;
            } else if (applicationState.userPreferences.libraryPath.indexOf(newWatchFolder.path) >= 0) {
                alert(`${newWatchFolder.path} is a part of the library path. Please select a folder outside the library path.`);
                setSelectedFolderPath('');
                return;
            }
            setIsWatchFolderProcessing(true);
            window.api.addWatchFolder(newWatchFolder).then((data) => {
                if (data.length > 0) {
                    const updatedWatchFolders = [...watchFolders, newWatchFolder];
                    dispatchEvent({
                        type: applicationEvents.WATCH_FOLDERS_UPDATE,
                        payload: { watchFolders: updatedWatchFolders },
                    });
                    setWatchFolders(updatedWatchFolders);
                    setSelectedFolderPath('');
                }
                setIsWatchFolderProcessing(false);
            });
        } else {
            setHadFolderSelectionStarted(true);
            window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, {
                event: rendererEvents.OPEN_WATCH_FOLDER,
            });
        }
    };

    const handleRemoveFolder = (folderId) => {
        if (!window.confirm('Are you sure you want to remove this folder from watch?')) {
            return;
        }

        const updatedWatchFolders = watchFolders.filter((folder) => folder.id !== folderId);
        window.api.removeWatchFolder(folderId).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                dispatchEvent({
                    type: applicationEvents.WATCH_FOLDERS_UPDATE,
                    payload: { watchFolders: updatedWatchFolders },
                });
                showGlobalNotification('Watch folder removed.');
                setWatchFolders(updatedWatchFolders);
            } else {
                alert('Failed to remove folder from watch.', response.message);
            }
        });
    };

    return (
        <div>
            <div className={settingsStyle.formInputLabel}>Watch Folders</div>
            <input
                type="text"
                className={settingsStyle.formInputDisabledSelection}
                placeholder="Select a folder"
                value={selectedFolderPath}
                readOnly={true}
            />
            <Button onClick={() => handleAddFolder()} processing={isWatchFolderProcessing}>
                {selectedFolderPath ? 'Add to watch' : 'Select a folder to add'}
            </Button>
            {watchFolders[0] && (
                <ul className={formStyles.editableFormList}>
                    {watchFolders.map((item) => (
                        <li key={item.id}>
                            {item.path}
                            <IconButton icon={'close'} onClick={() => handleRemoveFolder(item.id)} title="remove" />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default WatchFolders;
