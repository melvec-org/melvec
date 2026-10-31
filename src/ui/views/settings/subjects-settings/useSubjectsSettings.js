import { useEffect, useState } from 'react';
import ipcChannels from '__constants/ipcChannels';
import mainThreadEvents from '__events/mainThreadEvents';

const useSubjectsSettings = () => {
    const [faceExtractionStatus, setFaceExtractionStatus] = useState({
        status: 'idle',
        progress: {
            currentIndex: 0,
            totalItems: 0,
            currentMediaId: '',
            message: '',
        },
        error: null,
        currentMediaStatus: {
            status: null,
        },
    });

    const [isFaceExtractionInProgress, setIsFaceExtractionInProgress] = useState(false);
    const [pendingFaceExtractionCount, setPendingFaceExtractionCount] = useState(0);
    const [isPendingFaceExtractionCountLoading, setIsPendingFaceExtractionCountLoading] = useState(true);

    const loadPendingFaceExtractionCount = async () => {
        setIsPendingFaceExtractionCountLoading(true);

        const response = await window.api.getPendingFaceExtractionCount();

        if (response?.status === 'success') {
            setPendingFaceExtractionCount(response.data?.count || 0);
        }

        setIsPendingFaceExtractionCountLoading(false);
        return response;
    };

    const startFaceExtraction = async () => {
        const response = await window.api.startFaceExtraction();

        if (response?.status === 'success') {
            setIsFaceExtractionInProgress(true);
        }

        return response;
    };

    const stopFaceExtraction = async () => {
        const response = await window.api.stopFaceExtraction();

        if (response?.status === 'success') {
            setIsFaceExtractionInProgress(false);
            loadPendingFaceExtractionCount();
        }

        return response;
    };

    useEffect(() => {
        loadPendingFaceExtractionCount();
    }, []);

    useEffect(() => {
        const onFaceExtractionUpdate = (payload) => {
            if (!payload || payload.event !== mainThreadEvents.ON_BATCH_FACE_EXTRACTION_PROCESS) {
                return;
            }

            const nextStatus = payload.data || payload.payload || payload;
            const isInProgress = nextStatus?.status === 'processing' || nextStatus?.status === 'stopping';

            setFaceExtractionStatus(nextStatus);
            setIsFaceExtractionInProgress(isInProgress);

            /*
             * Do not refresh pendingFaceExtractionCount when the batch ends.
             * Refreshing immediately can set the count to 0 and unmount the
             * face extraction section, which hides the final completion/error
             * details. The next mount will call loadPendingFaceExtractionCount()
             * and hide the section if there is still no pending work.
             */
        };

        window.api.receive(ipcChannels.EVENT_STREAM, onFaceExtractionUpdate);

        return () => {
            window.api.stop(ipcChannels.EVENT_STREAM, onFaceExtractionUpdate);
        };
    }, []);

    return {
        startFaceExtraction,
        stopFaceExtraction,
        faceExtractionStatus,
        isFaceExtractionInProgress,
        pendingFaceExtractionCount,
        isPendingFaceExtractionCountLoading,
        shouldShowFaceExtractionSection: isFaceExtractionInProgress || pendingFaceExtractionCount > 0,
    };
};

export default useSubjectsSettings;
