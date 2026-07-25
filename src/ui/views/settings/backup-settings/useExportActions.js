// import react
import mainThreadEvents from '__events/mainThreadEvents';
import rendererEvents from '__events/rendererEvents';
import React, { useState } from 'react';
import ipcChannels from '__constants/ipcChannels';
import responseStatus from '__constants/responseStatus';

const useExportActions = () => {
    const [exportVideosState, setExportVideosState] = useState({
        status: 'idle',
    });

    const [exportFolderPath, setExportFolderPath] = useState('');

    const [showProgressIndicator, setShowProgressIndicator] = useState(false);

    const onExportVideoFolderSelect = () => {
        window.api.receive(ipcChannels.OPEN_FOLDERS_ACTION, (data) => {
            if (data.event === mainThreadEvents.ON_EXPORT_FOLDER_SELECTED) {
                if (data.payload !== null) {
                    setExportFolderPath(data.payload);
                } else {
                    setExportFolderPath('');
                }
            }
        });
        window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, { event: rendererEvents.OPEN_EXPORT_FOLDER });
    };

    const exportProgressHandler = (stream) => {
        if (stream.event === mainThreadEvents.VIDEO_EXPORT_PROGRESS) {
            const exportState = stream?.data || { status: 'failure' };
            if (exportState.status === responseStatus.SUCCESS) {
                window.api.stop(ipcChannels.EVENT_STREAM, exportProgressHandler);
            }

            setExportVideosState((prev) => {
                return exportState;
            });
        }
    };

    const startExporting = (collectionsList = [], destinationPath) => {
        window.api.stop(ipcChannels.EVENT_STREAM, exportProgressHandler);
        window.api.receive(ipcChannels.EVENT_STREAM, exportProgressHandler);
        window.api.startExportingVideos({
            collectionsList: collectionsList,
            trackingId: 'backup-' + Date.now(),
            destinationPath: destinationPath,
        });
        setShowProgressIndicator(true);
    };

    const resetExportSettings = () => {
        setShowProgressIndicator(false);
        setExportFolderPath('');
    };

    return {
        startExporting,
        exportVideosState,
        showProgressIndicator,
        resetExportSettings,
        exportFolderPath,
        onExportVideoFolderSelect,
    };
};
export default useExportActions;
