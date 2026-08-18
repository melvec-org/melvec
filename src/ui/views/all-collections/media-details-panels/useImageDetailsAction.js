import systemConfig from '__configs/systemConfig';
import ipcChannels from '__constants/ipcChannels';
import mediaTypes from '__constants/mediaTypes';
import responseStatus from '__constants/responseStatus';
import applicationEvents from '__events/applicationEvents';
import rendererEvents from '__events/rendererEvents';

const { useApplicationContext } = require('__contexts/app.context');
const { useState, useEffect } = require('react');
import getEligibleCollections from '__utils/getEligibleCollections';

const useImageDetailsAction = (imageDetails, onDetailsChange) => {
    const [stateContext, dispatchContext] = useApplicationContext();
    const [updatedImageDetails, setUpdatedImageDetails] = useState(imageDetails);

    /**
     * title change is one way as of now,
     * server need not respond right away,
     * in next update, the ui would fetch the updated meta data and this would reflect.
     * @param {*} title
     */
    const updateTitle = (mediaId, title) => {
        window.api.updateMediaTitle(mediaTypes.IMAGE, mediaId, title).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                onDetailsChange({
                    change: 'titleChange',
                    data: response.data,
                });
            }
        });
    };

    const updateNsfwStatus = (mediaId, isNsfw) => {
        window.api.updateMediaNsfwStatus(mediaTypes.IMAGE, mediaId, isNsfw).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                setUpdatedImageDetails({ ...updatedImageDetails, isNsfw: isNsfw });
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
                mediaType: mediaTypes.IMAGE,
                oldCollection: oldCollection,
                newCollection: newCollection,
            });
            alert(
                'Your image is moved to the new collection. You will temporary see the image in this collection till you are in this collection.',
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
                    message: 'Moving video to collection...',
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
        if (imageDetails.id) {
            if (!imageDetails.isExternal) {
                refreshshImageDetails('imageIdChange');
            } else {
                if (!imageDetails.isDuplicate) {
                    imageDetails.allowedCollections = getEligibleCollections(
                        imageDetails.birthtimeMs,
                        false,
                        stateContext.collections,
                        stateContext.hideHiddenCollections,
                    );
                } else {
                    imageDetails.allowedCollections = [];
                }
                setUpdatedImageDetails(imageDetails);
            }
        }
    }, [imageDetails.id, stateContext.collections]);

    const refreshshImageDetails = (eventSource = '') => {
        window.api.getFullImageDetails(imageDetails.id).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                let data = response.data;

                const isDefaultCollection = data.collectionId === systemConfig.DEFAULT_COLLECTION_ID;

                data.allowedCollections = getEligibleCollections(
                    data.birthtimeMs,
                    isDefaultCollection,
                    stateContext.collections,
                    stateContext.hideHiddenCollections,
                );

                setUpdatedImageDetails(data);
            }
        });
    };

    return {
        updatedImageDetails,
        updateTitle,
        updateNsfwStatus,
        moveToCollection,
        refreshshImageDetails,
    };
};

export default useImageDetailsAction;
