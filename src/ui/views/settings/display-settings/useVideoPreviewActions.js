import { useEffect, useState } from 'react';
import mainThreadEvents from '__events/mainThreadEvents';
import ipcChannels from '__constants/ipcChannels';
import batchProcessStates from '__constants/batchProcessStates';
import responseStatus from '__constants/responseStatus';

const useVideoPreviewActions = () => {
    const [batchPreviewStatus, setBatchPreviewStatus] = useState({
        currentState: batchProcessStates.IDLE,
        progressMessage: '',
        currentIndex: 0,
        totalItems: 0,
    });

    const handleBatchPreviewStream = (stream) => {
        if (stream.event !== mainThreadEvents.ON_BATCH_PREVIEW_PROCESS) return;

        const { status, progress, error } = stream.data;

        if (status === batchProcessStates.ERROR) {
            setBatchPreviewStatus({
                currentState: batchProcessStates.ERROR,
                progressMessage: error || 'An error occurred during preview generation.',
                currentIndex: 0,
                totalItems: 0,
            });
            return;
        }

        setBatchPreviewStatus({
            currentState: status,
            progressMessage: progress.message,
            currentIndex: progress.currentIndex,
            totalItems: progress.totalItems,
        });
    };

    const startBatchPreviewGeneration = () => {
        window.api.startBatchVideoPreviewGeneration().then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
            }
        });
    };

    const stopBatchPreviewGeneration = () => {
        window.api.stopBatchVideoPreviewGeneration().then((response) => {
            if (response.status !== responseStatus.SUCCESS) {
                alert(response.message);
            }
        });
    };

    useEffect(() => {
        window.api.receive(ipcChannels.EVENT_STREAM, handleBatchPreviewStream);

        return () => {
            window.api.stop(ipcChannels.EVENT_STREAM, handleBatchPreviewStream);
        };
    }, []);

    const isProcessing =
        batchPreviewStatus.currentState === batchProcessStates.PROCESSING ||
        batchPreviewStatus.currentState === batchProcessStates.STOPPING;
    const isTerminal =
        batchPreviewStatus.currentState === batchProcessStates.COMPLETE || batchPreviewStatus.currentState === batchProcessStates.STOPPED;

    return {
        batchPreviewStatus,
        isProcessing,
        isTerminal,
        startBatchPreviewGeneration,
        stopBatchPreviewGeneration,
    };
};

export default useVideoPreviewActions;
