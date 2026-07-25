import ipcChannels from '__constants/ipcChannels';
import mediaTypes from '__constants/mediaTypes';
import responseStatus from '__constants/responseStatus';
import { showGlobalError, showGlobalNotification } from '__contexts/AppNotificationContext';
import mainThreadEvents from '__events/mainThreadEvents';
import React, { useState, useCallback, useEffect, useRef } from 'react';

const useEditableDescriptionAction = () => {
    const [isDescGenInProgress, setIsDescGenInProgress] = useState(false);
    const [isDescProcessing, setIsDescProcessing] = useState(false);
    const [metaData, setMetaData] = useState({
        transcript: null,
        description: null,
    });
    const [metaDataFromServer, setMetaDataFromServer] = useState({
        transcript: null,
        description: null,
        descriptionSource: null,
    });

    const [shouldGenerateTitle, setShouldGenerateTitle] = useState(false);

    const listenerRef = useRef(null);

    const stopListening = useCallback(() => {
        window.api.stop(ipcChannels.EVENT_STREAM, listenerRef.current);
        setIsDescGenInProgress(false);
    }, []);

    const saveDescription = (mediaType, mediaId, description) => {
        setIsDescProcessing(true);
        const responseHander = (response) => {
            if (response.status === responseStatus.SUCCESS) {
                alert('Description saved successfully.');
            } else {
                showGlobalError(response.message);
            }
            setIsDescProcessing(false);
        };
        if (mediaType === mediaTypes.VIDEO) {
            window.api.setVideoDescription(mediaId, description).then(responseHander);
        } else if (mediaType === mediaTypes.IMAGE) {
            window.api.setImageDescription(mediaId, description).then(responseHander);
        }
    };

    const listenToDescGenStatus = useCallback(
        (stream) => {
            const isRelevantEvent =
                stream.event === mainThreadEvents.ON_VIDEO_DESCRIPTION_GENERATED ||
                stream.event === mainThreadEvents.ON_IMAGE_DESCRIPTION_GENERATED;
            if (!isRelevantEvent) return;

            const data = stream.data;

            if (data.status === 'completed') {
                setMetaData({
                    transcript: data.transcript,
                    description: data.description,
                });
                stopListening();
            } else if (data.status === 'failed') {
                showGlobalError(data.error || 'Failed to generate description.');
                stopListening();
            } else if (data.status === 'cancelled') {
                showGlobalNotification('Description generation was cancelled.');
                stopListening();
            }
        },
        [stopListening],
    );

    useEffect(() => {
        listenerRef.current = listenToDescGenStatus;
    }, [listenToDescGenStatus]);

    useEffect(() => {
        return () => stopListening();
    }, [stopListening]);

    const generateAIDescription = (mediaType, mediaId) => {
        setIsDescGenInProgress(true);

        if (mediaType === mediaTypes.VIDEO) {
            window.api.generateVideoDescription(mediaId, shouldGenerateTitle).then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    const { status, accepted } = response.data;
                    if (accepted === false && status === 'processing') {
                        alert('Description generation is already in progress.');
                        setIsDescGenInProgress(true);
                    } else if (accepted === false && status === 'inQueue') {
                        alert('This description generation is already in queue.');
                        setIsDescGenInProgress(false);
                    } else if (accepted === true && status === 'processing') {
                        setIsDescGenInProgress(true);
                        window.api.receive(ipcChannels.EVENT_STREAM, listenToDescGenStatus);
                    }
                }
            });
        } else if (mediaType === mediaTypes.IMAGE) {
            window.api.generateImageDescription(mediaId, shouldGenerateTitle).then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    const { status, accepted } = response.data;
                    if (accepted === false && status === 'processing') {
                        alert('Description generation is already in progress.');
                        setIsDescGenInProgress(true);
                    } else if (accepted === false && status === 'inQueue') {
                        alert('This description generation is already in queue.');
                        setIsDescGenInProgress(false);
                    } else if (accepted === true && status === 'processing') {
                        setIsDescGenInProgress(true);
                        window.api.receive(ipcChannels.EVENT_STREAM, listenToDescGenStatus);
                    }
                }
            });
        }
    };

    const getVideoMetaDataDetails = (videoId) => {
        window.api.getVideoMetaDataDetails(videoId).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setMetaData({
                    transcript: response.data.transcript,
                    description: response.data.description,
                    transcriptSource: response.data.transcriptSource,
                });
            }
        });
    };

    const getImageMetaDataDetails = (imageId) => {
        window.api.getImageMetaDataDetails(imageId).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setMetaData({
                    transcript: null,
                    description: response.data.description ?? null,
                });
            }
        });
    };

    const getMediaMetaDataDetails = (mediaType, mediaId) => {
        if (mediaType === mediaTypes.IMAGE) {
            getImageMetaDataDetails(mediaId);
        } else {
            getVideoMetaDataDetails(mediaId);
        }
    };

    const generateTranscript = (videoId) => {
        window.api.generateTranscript(videoId).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setMetaDataFromServer({ ...metaDataFromServer, transcript: response.data.transcript });
                setMetaData({ ...metaData, transcript: response.data.transcript });
                alert('Transcript generated successfully.');
            } else {
                alert('Failed to generate transcript.');
            }
        });
    };

    const stopGeneratingAIDescription = (mediaType, mediaId) => {
        if (mediaType === mediaTypes.VIDEO) {
            window.api.stopGeneratingVideoDescription(mediaId).then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    alert('Processing stopped successfully.');
                    setIsDescGenInProgress(false);
                } else {
                    alert(response.message);
                }
            });
        } else {
            window.api.stopGeneratingImageDescription(mediaId).then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    alert('Processing stopped successfully.');
                    setIsDescGenInProgress(false);
                } else {
                    alert(response.message);
                }
            });
        }
    };
    return {
        saveDescription,
        generateAIDescription,
        stopGeneratingAIDescription,
        isDescGenInProgress,
        getVideoMetaDataDetails,
        getMediaMetaDataDetails,
        generateTranscript,
        metaDataFromServer,
        metaData,
        setMetaData,
        shouldGenerateTitle,
        setShouldGenerateTitle,
        isDescProcessing,
    };
};
export default useEditableDescriptionAction;
