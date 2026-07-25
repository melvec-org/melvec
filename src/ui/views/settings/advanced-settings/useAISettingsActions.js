import { useApplicationContext } from '__contexts/app.context';
import applicationEvents from '__events/applicationEvents';
import mainThreadEvents from '__events/mainThreadEvents';
import ipcChannels from '__constants/ipcChannels';
import mediaTypes from '__constants/mediaTypes';
import batchProcessStates from '__constants/batchProcessStates';
import { showGlobalNotification } from '__contexts/AppNotificationContext';
import rendererEvents from '__events/rendererEvents';
import responseStatus from '__constants/responseStatus';

const { useEffect, useState } = require('react');

export const downloadStates = {
    IDLE: 'idle',
    DOWNLOADING: 'downloading',
    PAUSED: 'paused',
    COMPLETE: 'complete',
    ERROR: 'error',
};

const useAISettingsActions = () => {
    const [AIModelsStatus, setAIModelsStatus] = useState(null);
    const [applicationStateContext, dispatchContext] = useApplicationContext();
    const [batchDescGenProcessStatus, setBatchDescGenProcessStatus] = useState({
        currentState: batchProcessStates.IDLE,
        progressMessage: '',
        batchMediaType: null,
    });

    const [downloadStatus, setDownloadStatus] = useState({
        currentState: downloadStates.IDLE,
        isDownloadingViaChrome: false,
        progressMessage: '',
    });

    const userPreferences = applicationStateContext?.userPreferences || null;
    const isAISupported = Boolean(userPreferences?.isAISupported);
    const isAIEnabled = Boolean(userPreferences?.isAIEnabled);
    const selectedModelTier = userPreferences?.ai?.modelTier || 'basic';
    const [modelImportInProgress, setIsImportInProgress] = useState(false);

    // TODO this may get triggered multiple times if mount and unmount happens
    const downloadProgressHandler = (stream) => {
        if (stream.event === mainThreadEvents.ON_AI_MODEL_DOWNLOAD) {
            if (stream.data.overallStatus === responseStatus.SUCCESS) {
                window.api.stop(ipcChannels.EVENT_STREAM, downloadProgressHandler);
            }
            if (stream.data.overallStatus !== 'error') {
                setDownloadStatus({
                    currentState:
                        stream.data.overallStatus === responseStatus.SUCCESS ? downloadStates.COMPLETE : downloadStates.DOWNLOADING,
                    progressMessage: stream.data.currentItemStatus,
                    isDownloadingViaChrome: stream.data.downloadMode === 'chromium',
                });
            } else {
                setDownloadStatus({
                    currentState: downloadStates.ERROR,
                    errorMessage: stream.data.error,
                    note: stream.data.note,
                });
            }
        }
    };

    const downloadAIModels = () => {
        // check for internet
        const isOnline = navigator.onLine;
        if (!isOnline) {
            alert('You are not currently connected to internet. Please check your connection.');
            return;
        }
        window.api.receive(ipcChannels.EVENT_STREAM, downloadProgressHandler);
        window.api.downloadAIModels().then((response) => {
            if (response?.status == responseStatus.SUCCESS) {
                setDownloadStatus({
                    currentState: downloadStates.DOWNLOADING,
                    progressMessage: 'Download started',
                });
            } else {
                window.api.stop(ipcChannels.EVENT_STREAM, downloadProgressHandler);
                alert('Failed to download AI models.', response.message);
            }
        });
    };

    const toggleAIFeature = (nextIsAIEnabled) => {
        window.api.setUserPreference('isAIEnabled', nextIsAIEnabled).then((updatedPreferences) => {
            dispatchContext({
                type: applicationEvents.USER_PREFERENCE_UPDATE,
                payload: {
                    userPreferences: updatedPreferences,
                },
            });
        });
    };

    const setAIModelTier = (tier) => {
        window.api.getUserPreference('ai').then((aiConfig) => {
            if (aiConfig && aiConfig.modelTier !== tier) {
                aiConfig.modelTier = tier;
                window.api.setUserPreference('ai', aiConfig).then((updatedPreferences) => {
                    dispatchContext({
                        type: applicationEvents.USER_PREFERENCE_UPDATE,
                        payload: {
                            userPreferences: updatedPreferences,
                        },
                    });
                });
            }
        });
    };

    const deleteAIModels = () => {
        window.confirm('Are you sure, you want to delete the models?') &&
            window.api.deleteAIModelFiles(selectedModelTier).then((response) => {
                if (response.status == responseStatus.SUCCESS) {
                    alert('AI model files cleaned up successfully.');
                    checkForModelAvailability(selectedModelTier);
                } else {
                    alert('Failed to clean up AI model files.', response?.message);
                }
            });
    };

    const checkForModelAvailability = (modelTier) => {
        window.api.checkForAIModelFiles(modelTier).then((response) => {
            if (response?.status == responseStatus.SUCCESS) {
                if (response.data.status === 'OK') {
                    setAIModelsStatus('AVAILABLE');
                } else if (response.data.status === 'DOWNLOADING') {
                    setAIModelsStatus('UNAVAILABLE');
                    window.api.receive(ipcChannels.EVENT_STREAM, downloadProgressHandler);
                } else {
                    setAIModelsStatus('UNAVAILABLE');
                }
            } else {
                alert('Error checking the AI Models.');
            }
        });
    };

    const pauseDownload = (modelTier) => {
        window.api.pauseDownloadAIModels(modelTier).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setDownloadStatus({ ...downloadStatus, currentState: downloadStates.PAUSED });
            }
        });
    };

    const resumeDownload = (modelTier) => {
        window.api.resumeDownloadAIModels(modelTier).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setDownloadStatus({ ...downloadStatus, currentState: downloadStates.DOWNLOADING });
            }
        });
    };

    const cancelDownload = () => {
        window.api.cancelDownloadAIModels().then((respond) => {
            if (respond.status === responseStatus.SUCCESS) {
                window.api.stop(ipcChannels.EVENT_STREAM, downloadProgressHandler);

                setDownloadStatus({
                    currentState: downloadStates.IDLE,
                    isDownloadingViaChrome: false,
                    progressMessage: '',
                });
            }
        });
    };

    const startImageMetaDataGeneration = () => {
        window.api.startImageMetaDataBatchGeneration().then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
            }
        });
    };

    const handleBatchMediaMetaDataGeneration = (stream) => {
        if (stream.event === mainThreadEvents.ON_BATCH_DESCRIPTION_PROCESS) {
            const { status, batchMediaType, progress, error } = stream.data;

            if (status === 'error') {
                setBatchDescGenProcessStatus({
                    currentState: batchProcessStates.ERROR,
                    errorMessage: error,
                });
                alert('There is an error while generating descriptions.', error);
                return;
            }
            const isTerminal = status === batchProcessStates.COMPLETE || status === batchProcessStates.STOPPED;

            setBatchDescGenProcessStatus({
                currentState: isTerminal ? status : batchProcessStates.PROCESSING,
                progressMessage: progress.message,
                batchMediaType: isTerminal ? null : batchMediaType,
            });

            if (status === batchProcessStates.COMPLETE && batchMediaType === mediaTypes.VIDEO) {
                startImageMetaDataGeneration();
            }
        }
    };

    const startBatchMediaMetaDataGeneration = () => {
        window.api.startBatchVideoMetaDataGeneration().then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
            }
        });
    };

    /**
     * Sends the request to stop processing based on current mediaType
     * @returns
     */
    const stopBatchMediaMetaDataGeneration = () => {
        const { batchMediaType } = batchDescGenProcessStatus;

        if (!batchMediaType) {
            alert('No batch generation in progress.');
            return;
        }

        if (batchMediaType === mediaTypes.VIDEO) {
            window.api.stopBatchVideoMetaDataGeneration().then((response) => {
                if (response.status !== responseStatus.SUCCESS) {
                    alert('Failed to stop batch video description generation.', response?.message);
                }
            });
        } else if (batchMediaType === mediaTypes.IMAGE) {
            window.api.stopImageMetaDataBatchGeneration().then((response) => {
                if (response.status !== responseStatus.SUCCESS) {
                    alert('Failed to stop batch image metadata generation.', response?.message);
                }
            });
        }
    };

    const importModelsFromLocalPath = () => {
        setIsImportInProgress(true);
        window.api.receive(ipcChannels.OPEN_FOLDERS_ACTION, (data) => {
            if (data.event === mainThreadEvents.ON_AI_LOCAL_IMPORT_DIR_SELECT) {
                if (data.payload !== null) {
                    window.api.importModelsFromManualDownload(data.payload).then((response) => {
                        if (response.status === responseStatus.SUCCESS) {
                            showGlobalNotification('Restart the app to see AI in action.');
                        } else {
                            alert(response.message);
                        }
                        setIsImportInProgress(false);
                    });
                }
            }
        });
        window.api.send(ipcChannels.OPEN_FOLDERS_REQUEST, {
            event: rendererEvents.OPEN_LOCAL_MODELS_FOLDER,
        });
    };

    useEffect(() => {
        window.api.receive(ipcChannels.EVENT_STREAM, handleBatchMediaMetaDataGeneration);

        return () => {
            window.api.stop(ipcChannels.EVENT_STREAM, handleBatchMediaMetaDataGeneration);
        };
    }, []);

    useEffect(() => {
        checkForModelAvailability(selectedModelTier);
    }, [selectedModelTier]);

    return {
        isAISupported,
        isAIEnabled,
        selectedModelTier,
        downloadAIModels,
        AIModelsStatus,
        toggleAIFeature,
        setAIModelTier,
        deleteAIModels,
        pauseDownload,
        resumeDownload,
        cancelDownload,
        downloadStatus,
        startBatchMediaMetaDataGeneration,
        stopBatchMediaMetaDataGeneration,
        batchDescGenProcessStatus,
        importModelsFromLocalPath,
    };
};

export default useAISettingsActions;
