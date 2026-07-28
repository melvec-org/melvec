import systemConfig from '__configs/systemConfig';
import ipcChannels from '__constants/ipcChannels';
import mediaTypes from '__constants/mediaTypes';
import responseStatus from '__constants/responseStatus';
import applicationEvents from '__events/applicationEvents';
import rendererEvents from '__events/rendererEvents';

const { useApplicationContext } = require('__contexts/app.context');
const { useState, useEffect } = require('react');
import getEligibleCollections from '__utils/getEligibleCollections';

const useAudioDetailsAction = (audioDetails, onDetailsChange) => {
    const [stateContext, dispatchContext] = useApplicationContext();
    const [updatedAudioDetails, setUpdatedAudioDetails] = useState(audioDetails);

    /**
     * title change is one way as of now,
     * server need not respond right away,
     * in next update, the ui would fetch the updated meta data and this would reflect.
     * @param {*} title
     */
    const updateTitle = (mediaId, title) => {
        window.api.updateMediaTitle(mediaTypes.AUDIO, mediaId, title).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                onDetailsChange({
                    change: 'titleChange',
                    data: response.data,
                });
            }
        });
    };

    const updateNsfwStatus = (mediaId, isNsfw) => {
        window.api.updateMediaNsfwStatus(mediaTypes.AUDIO, mediaId, isNsfw).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                setUpdatedAudioDetails({ ...updatedAudioDetails, isNsfw: isNsfw });
                onDetailsChange({
                    change: 'isNsfw',
                    data: {
                        mediaId,
                        isNsfw: Boolean(isNsfw),
                    },
                });
            } else {
                alert('Failed to update NSFW status.', response.message);
            }
        });
    };

    /**
     * moveToCollection is to be fired when watch folder items are moved to any
     * existing collection, this will also trigger a freezer and a show a toast.
     */
    const moveToCollection = ({ mediaId, oldCollection, newCollection, isExternal } = eventData) => {
        if (!isExternal) {
            window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                event: rendererEvents.MEDIA_SWITCH_COLLECTION,
                mediaId: mediaId,
                mediaType: mediaTypes.AUDIO,
                oldCollection: oldCollection,
                newCollection: newCollection,
            });
            alert(
                'Your audio is moved to the new collection. You will temporary see the audio in this collection till you are in this collection.',
            );
            onDetailsChange({
                change: 'importToCollectionStart',
                data: { mediaId: mediaId },
            });
        } else {
            dispatchContext({
                type: applicationEvents.APP_STATUS_UPDATE,
                payload: {
                    freezeApp: false,
                    message: 'Moving audio to collection...',
                    messageAutoHide: true,
                },
            });
            onDetailsChange({
                change: 'importToCollectionStart',
                data: { mediaId: mediaId },
            });
            window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                event: rendererEvents.IMPORT_MEDIA_TO_COLLECTION,
                mediaId: mediaId,
                newCollection: newCollection,
            });
        }
    };

    useEffect(() => {
        if (audioDetails.id) {
            if (!audioDetails.isExternal) {
                refreshshAudioDetails('audioIdChange');
            } else {
                if (!audioDetails.isDuplicate) {
                    audioDetails.allowedCollections = getEligibleCollections(
                        audioDetails.birthtimeMs,
                        false,
                        stateContext.collections,
                        stateContext.hideHiddenCollections,
                    );
                } else {
                    audioDetails.allowedCollections = [];
                }
                setUpdatedAudioDetails(audioDetails);
            }
        }
    }, [audioDetails.id, stateContext.collections]);

    const refreshshAudioDetails = (eventSource = '') => {
        window.api.getFullAudioDetails(audioDetails.id).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                let data = response.data;

                const isDefaultCollection = data.collectionId === systemConfig.DEFAULT_COLLECTION_ID;

                data.allowedCollections = getEligibleCollections(
                    data.birthtimeMs,
                    isDefaultCollection,
                    stateContext.collections,
                    stateContext.hideHiddenCollections,
                );

                setUpdatedAudioDetails(data);
            }
        });
    };

    return {
        updatedAudioDetails,
        updateTitle,
        updateNsfwStatus,
        moveToCollection,
        refreshshAudioDetails,
    };
};

export default useAudioDetailsAction;
