import rendererEvents from '__events/rendererEvents';
const { useApplicationContext } = require('__contexts/app.context');
const { useState, useEffect } = require('react');
import applicationEvents from '__events/applicationEvents';
import ipcChannels from '__constants/ipcChannels';
import getEligibleCollections from '__utils/getEligibleCollections';
import mediaTypes from '__constants/mediaTypes';
import systemConfig from '__configs/systemConfig';
import responseStatus from '__constants/responseStatus';

// for future ... we will use this function to indicate to user that the video is not comple with all information.
const checkVideoDetailsCompleteness = (videoDetails) => {
    const failureConditions = [
        { attr: 'title', check: '' },
        { attr: 'title', check: 'Untitled' },
        { attr: 'quality', check: 0 },
        { attr: 'quality', check: undefined },
        { attr: 'rating', check: 0 },
        { attr: 'shortDesc', check: '' },
        { attr: 'shortDesc', check: undefined },
        { attr: 'category', check: undefined },
        { attr: 'tags', check: [] },
    ];

    for (let i = 0; i < failureConditions.length; i++) {
        const condition = failureConditions[i];
        if (videoDetails[condition.attr] === condition.check) {
            return false;
        }
    }

    return true;
};

const useVideoDetailsAction = (videoDetails, onDetailsChange) => {
    const [stateContext, dispatchContext] = useApplicationContext();
    const [updatedVideoDetails, setUpdatedVideoDetails] = useState(videoDetails);

    /**
     * moveToCollection is to be fired when watch folder items are moved to any
     * existing collection, this will also trigger a freezer and a show a toast.
     */
    const moveToCollection = ({ mediaId, oldCollection, newCollection, isExternal } = eventData) => {
        if (!isExternal) {
            window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                event: rendererEvents.MEDIA_SWITCH_COLLECTION,
                mediaId: mediaId,
                mediaType: mediaTypes.VIDEO,
                oldCollection: oldCollection,
                newCollection: newCollection,
            });
            alert('Your video is moved to the new collection. You will temporary see the video in this collection.');
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
                data: { videoId: mediaId },
            });

            window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                event: rendererEvents.IMPORT_MEDIA_TO_COLLECTION,
                mediaId: mediaId,
                newCollection: newCollection,
                mediaType: mediaTypes.VIDEO,
            });
        }
    };

    /**
     * title change is one way as of now,
     * server need not respond right away,
     * in next update, the ui would fetch the updated meta data and this would reflect.
     * @param {*} title
     */
    const updateTitle = (mediaId, title) => {
        window.api.updateMediaTitle('video', mediaId, title).then((data) => {
            onDetailsChange({
                change: 'titleChange',
                data: data,
            });
        });
    };

    const udpateSource = (videoId, source) => {
        window.api.updateVideoSource(videoId, source).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                setUpdatedVideoDetails({ ...updatedVideoDetails, source: source });
            } else {
                alert('Failed to update video source.', response.message);
            }
        });
    };

    const updateNsfwStatus = (videoId, isNsfw) => {
        window.api.updateMediaNsfwStatus('video', videoId, isNsfw).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                setUpdatedVideoDetails({ ...updatedVideoDetails, isNsfw: isNsfw });
                onDetailsChange({
                    change: 'isNsfw',
                    data: {
                        videoId,
                        isNsfw: Boolean(isNsfw),
                    },
                });
            } else {
                alert('Failed to update NSFW status.', response.message);
            }
        });
    };

    const updateCategory = (videoId, categoryId) => {
        window.api.updateVideoCategory(videoId, categoryId).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                setUpdatedVideoDetails({ ...updatedVideoDetails, categoryId: categoryId });

                onDetailsChange({
                    change: 'categoryId',
                    data: {
                        videoId,
                        categoryId,
                    },
                });
            } else {
                alert('Failed to update video category.', response.message);
            }
        });
    };

    useEffect(() => {
        if (videoDetails.id) {
            if (!videoDetails.isExternal) {
                refreshshVideoDetails('videoIdUpdate');
            } else {
                if (!videoDetails.isDuplicate) {
                    let allowedCollections = getEligibleCollections(
                        videoDetails.birthtimeMs,
                        false,
                        stateContext.collections,
                        stateContext.hideHiddenCollections,
                    );
                    videoDetails.allowedCollections = allowedCollections;
                } else {
                    videoDetails.allowedCollections = [];
                }

                setUpdatedVideoDetails(videoDetails);
            }
        }
    }, [videoDetails.id, stateContext.collections]);

    const refreshshVideoDetails = (source) => {
        window.api.getFullVideoDetails(videoDetails.id).then((data) => {
            if (data) {
                const isDefaultCollection = data.collectionId === systemConfig.DEFAULT_COLLECTION_ID;

                data.allowedCollections = getEligibleCollections(
                    data.birthtimeMs,
                    isDefaultCollection,
                    stateContext.collections,
                    stateContext.hideHiddenCollections,
                );
                setUpdatedVideoDetails(data);
            }
        });
    };

    return {
        updatedVideoDetails,
        moveToCollection,
        updateTitle,
        udpateSource,
        updateNsfwStatus,
        updateCategory,
        refreshshVideoDetails,
    };
};

export default useVideoDetailsAction;
