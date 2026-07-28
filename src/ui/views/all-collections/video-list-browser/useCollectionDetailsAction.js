import { useApplicationContext } from '__contexts/app.context';
import mainThreadEvents from '__events/mainThreadEvents';
import rendererEvents from '__events/rendererEvents';
import applicationEvents from '__events/applicationEvents';
import { showGlobalError, showGlobalNotification } from '__contexts/AppNotificationContext';
import sortVideoList from '__utils/sortVideoList';
import ipcChannels from '__constants/ipcChannels';
import mediaTypes from '__constants/mediaTypes';
import batchProcessStates from '__constants/batchProcessStates';
import responseStatus from '__constants/responseStatus';

const { useEffect, useState } = require('react');

const useCollectionDetailsAction = (currentCollection, currentVideoId = null) => {
    const [currentMediaDetails, setCurrentMediaDetails] = useState(null);
    const [mediaList, setMediaList] = useState({ listName: '', list: [] });
    const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
    const isBulkMode = bulkSelectedIds.length > 0;
    const bulkSelectedItems = mediaList.list.filter((item) => bulkSelectedIds.includes(item.id));
    const [viewType, setViewType] = useState('grid');
    const [stateContext, dispatchContext] = useApplicationContext();
    const [isRefreshInProgress, setIsRefreshInProgress] = useState(false);

    const [sortOption, setSortOption] = useState('fileSizeDesc');

    /**
     * change the view type - Note this is browser view only.
     * Save the view type in application settings, so that next time it will show the same view
     * @param {*} type
     */
    const changeViewType = (type) => {
        setViewType(type);

        window.api.setApplicationSettings('browserVideoListViewType', type);
    };

    // check for viewtype on initialization

    const onSortingChange = (sortOption) => {
        setSortOption(sortOption);
    };

    const fetchFreshDetailsAndSetState = (currentCollection) => {
        window.api.getCollectionDetails(currentCollection.id, currentCollection.isExternal).then((mediaArr) => {
            if (mediaArr[0]) {
                mediaArr = mediaArr.map((item) => {
                    item.isExternal = currentCollection.isExternal;
                    return item;
                });
            }
            const sortedMedia = sortVideoList(mediaArr, sortOption);

            setMediaList({ listName: currentCollection.label, list: sortedMedia });

            // check if some video is selected from search which changed browser state
            if (stateContext?.currentBrowserState?.selectedVideoId) {
                const selectedMedia = mediaArr.find((item) => item.id === stateContext?.currentBrowserState?.selectedVideoId);
                if (selectedMedia) {
                    onMediaFileSelection(selectedMedia);
                }
            }
            // check from the last saved state
            else if (currentVideoId !== null) {
                const selectedMedia = mediaArr.find((item) => item.id === currentVideoId);
                if (selectedMedia) {
                    onMediaFileSelection(selectedMedia);
                }
            }
            // if no video is selected, show the first video
            else if (mediaArr[0]) {
                //setCurrentMediaDetails(mediaArr[0]);
                onMediaFileSelection(mediaArr[0]);
            } else {
                setCurrentMediaDetails(null);
            }
        });
    };

    useEffect(() => {
        if (currentCollection) {
            fetchFreshDetailsAndSetState(currentCollection);
        }
        // kill the currentBrowserState once you achive the state
        if (stateContext.currentBrowserState) {
            if (stateContext.currentBrowserState.selectedCollection !== currentCollection) {
                dispatchContext({
                    type: applicationEvents.GOTO_COLLECTION,
                    payload: null,
                });
            }
        }
    }, [currentCollection, currentVideoId]);

    useEffect(() => {
        window.api.getApplicationSettings('browserVideoListViewType').then((data) => {
            if (data && data !== viewType) {
                setViewType(data);
            }
        });
        window.api.receive(ipcChannels.NOTIFY_RENDERER_PROCESS, onVideoDetailsUpdate);

        return () => {
            window.api.stop(ipcChannels.NOTIFY_RENDERER_PROCESS, onVideoDetailsUpdate);
        };
    }, []);

    const onVideoDetailsUpdate = (message) => {
        if (message.event === mainThreadEvents.ON_VIDEO_DETAILS_UPDATE) {
            const videoToUpdate = message.payload.updatedVideoDetails;
            setCurrentMediaDetails(videoToUpdate);
        }
    };

    const onMediaFileSelection = (selectedVideoItem) => {
        setCurrentMediaDetails(selectedVideoItem);
        window.api.setApplicationSettings('lastBrowserState', {
            selectedCollection: currentCollection,
            selectedVideoId: selectedVideoItem.id,
        });
    };

    const onMediaDelete = (mediaType, mediaId, initiator = 'user') => {
        let confirmMessage = '';

        if (!mediaType) {
            mediaType = currentMediaDetails.mediaType;
        }

        if (initiator === 'user') {
            confirmMessage = `Are you sure you want to delete this ${mediaType}?`;
        } else if (initiator === 'ENOENT') {
            confirmMessage = `Failed to load ${mediaType}, looks like the file is deleted. Do you want to remove this from this app?`;
        }

        if (window.confirm(confirmMessage)) {
            if (currentCollection.isExternal) {
                window.api.removeMediaFromWatchFolder(mediaId, currentCollection.id, initiator).then((response) => {
                    if (response.status === responseStatus.SUCCESS) {
                        showGlobalNotification(responseStatus.SUCCESS, `Deleted ${mediaType}`);
                    } else {
                        showGlobalNotification(`Failed to delete ${mediaType}. ${response.message}`);
                    }
                });
            } else {
                window.api.removeMediaFromLibrary(mediaType, mediaId, initiator).then((response) => {
                    if (response.status === responseStatus.SUCCESS) {
                        showGlobalNotification(`File deleted successfully.`);
                    } else {
                        showGlobalError(`Error: Failed to delete ${mediaType}, try again later`);
                    }
                });
            }

            const currentMediaIndex = mediaList.list.findIndex((item) => item.id === mediaId);
            const updatedMediaArr = mediaList.list.filter((item) => item.id !== mediaId);
            const nextMedia = updatedMediaArr[currentMediaIndex >= updatedMediaArr.length ? updatedMediaArr.length - 1 : currentMediaIndex];
            // this check is for the case when the last media is delete
            if (nextMedia) {
                onMediaFileSelection(nextMedia);
            }
            setMediaList({ listName: currentCollection.label, list: updatedMediaArr });
        }
    };

    const getNextCollection = (currentCollectionId) => {
        const visibleCollections = stateContext.hideHiddenCollections
            ? stateContext.collections.filter((item) => item.isHidden === 0)
            : stateContext.collections;
        if (visibleCollections.length === 0) {
            return null;
        }
        const currentCollectionIndex = visibleCollections.findIndex((item) => item.id === currentCollectionId);

        if (currentCollectionIndex === -1) {
            return visibleCollections[0];
        }

        if (visibleCollections.length === 1) {
            return null;
        }
        const nextCollectionIndex = currentCollectionIndex >= visibleCollections.length - 1 ? 0 : currentCollectionIndex + 1;
        return visibleCollections[nextCollectionIndex];
    };

    const onCollectionDelete = () => {
        if (window.confirm('Are you sure, you want to delete the entire collection?') === true) {
            window.api.removeCollection(currentCollection.id).then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    dispatchContext({
                        type: applicationEvents.COLLECTIONS_UPDATE,
                        payload: { collections: response.data },
                    });
                }
            });

            const nextCollection = getNextCollection(currentCollection.id);

            if (nextCollection !== null) {
                dispatchContext({
                    type: applicationEvents.GOTO_COLLECTION,
                    payload: {
                        selectedCollection: nextCollection,
                    },
                });
            }
        }
    };

    const onFileNameChange = (id, fileName) => {
        setMediaList((prevState) => ({
            listName: prevState.listName,
            list: [...prevState.list].map((item) => {
                if (item.id === id) {
                    item.name = fileName;
                }
                return item;
            }),
        }));
    };

    const onNsfwStatusChange = (id, isNsfw) => {
        setMediaList((prevState) => ({
            listName: prevState.listName,
            list: [...prevState.list].map((item) => {
                if (item.id === id) {
                    item.isNsfw = isNsfw ? 1 : 0;
                }
                return item;
            }),
        }));
    };
    /**
     * When import starts, it's an async process. So check if the item exists in currrent medialist,
     * If not present that means, the medialist might have got changed. Ignore further activity
     * @param {*} mediaId
     */
    const onImportFileStart = (mediaId) => {
        // check for mediaId presence - if not found then it's a noops
        const isMediaPresent = mediaList.list.find((item) => item.id === mediaId);
        if (!isMediaPresent) return;

        // disable the item - so that no furhter action can be made on the item
        const updatedMediaArr = mediaList.list.map((item) => {
            if (item.id === mediaId) {
                item.disabled = true;
            }
            return item;
        });
        setMediaList({ listName: currentCollection.label, list: updatedMediaArr });

        if (!currentCollection.isExternal) return;

        // Now listen for import complete actioin from server - valid only for external collections
        window.api.receiveOnce(ipcChannels.IMPORTED_FROM_WATCH_FOLDER_ACTION, (data) => {
            if (data.status === responseStatus.SUCCESS && data.mediaId === mediaId) {
                const currentVideoIndex = mediaList.list.findIndex((item) => item.id === mediaId);

                const updatedMediaArr = mediaList.list.filter((item) => item.id !== mediaId);
                const nextMedia =
                    updatedMediaArr[currentVideoIndex >= updatedMediaArr.length ? updatedMediaArr.length - 1 : currentVideoIndex];
                if (nextMedia) {
                    onMediaFileSelection(nextMedia);
                }

                setMediaList({ listName: currentCollection.label, list: updatedMediaArr });
            } else {
                alert('There is some problem with the import process, please try again later.');
            }
        });
    };

    const onAnyVideoDetailsChange = ({ change, data }) => {
        switch (change) {
            case 'isNsfw':
                onNsfwStatusChange(data.mediaId, data.isNsfw);
                break;
            case 'fileName':
                onFileNameChange(data.videoId, data.fileName);
                break;
            case 'importToCollectionStart':
                onImportFileStart(data.mediaId);
                break;
            case 'deleteVideoFromLibrary':
                onMediaDelete(mediaTypes.VIDEO, data.mediaId, data.initiator);
                break;
            default:
        }
    };

    const onAnyImageDetailsChange = ({ change, data }) => {
        switch (change) {
            case 'isNsfw':
                onNsfwStatusChange(data.mediaId, data.isNsfw);
                break;
            case 'fileName':
                onFileNameChange(data.mediaId, data.fileName);
                break;
            case 'deleteImageFromLibrary':
                onMediaDelete(mediaTypes.IMAGE, data.mediaId, data.initiator);
                break;
            case 'importToCollectionStart':
                onImportFileStart(data.mediaId);
                break;
            default:
        }
    };

    const onAnyAudioDetailsChange = ({ change, data }) => {
        switch (change) {
            case 'isNsfw':
                onNsfwStatusChange(data.mediaId, data.isNsfw);
                break;
            case 'fileName':
                onFileNameChange(data.mediaId, data.fileName);
                break;
            case 'deleteAudioFromLibrary':
                onMediaDelete(mediaTypes.AUDIO, data.mediaId, data.initiator);
                break;
            case 'importToCollectionStart':
                onImportFileStart(data.mediaId);

                break;
            default:
        }
    };

    const deleteBulkMedia = (selectedItems) => {
        let confirmMessage = `Are you sure, you want to delete the selected ${selectedItems.length} media?`;
        if (window.confirm(confirmMessage)) {
            window.api.bulkRemoveMedia(selectedItems, currentCollection.id, currentCollection.isExternal).then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    const removedIds = new Set(response.data.mediaRemoved);

                    // Find the highest index among all deleted items — next selection lands right after the range
                    const lastDeletedIndex = Math.max(...selectedItems.map((item) => mediaList.list.findIndex((m) => m.id === item.id)));
                    const updatedMediaArr = mediaList.list.filter((item) => !removedIds.has(item.id));

                    // Select the item that was right after the deleted range, or the new last item
                    const nextIndex = Math.min(lastDeletedIndex, updatedMediaArr.length - 1);
                    if (updatedMediaArr[nextIndex]) {
                        onMediaFileSelection(updatedMediaArr[nextIndex]);
                    }

                    setMediaList({ listName: currentCollection.label, list: updatedMediaArr });
                    setBulkSelectedIds([]);
                    showGlobalNotification(`Deleted ${removedIds.size} media successfully.`);
                } else {
                    showGlobalError(`Failed to delete media, try again later`, true);
                }
            });
        }
    };

    const changeBulkNsfwStatus = (selectedItems, isNsfw) => {
        window.api.changeBulkMediaNsfwStatus(selectedItems, isNsfw).then((response) => {
            if (response.status === responseStatus.SUCCESS || response.data?.status === 'partial') {
                const updatedIds = new Set(response.data.mediaUpdated);
                setMediaList((prevState) => ({
                    listName: prevState.listName,
                    list: prevState.list.map((item) => {
                        if (updatedIds.has(item.id)) {
                            return { ...item, isNsfw: isNsfw ? 1 : 0 };
                        }
                        return item;
                    }),
                }));
                showGlobalNotification(`NSFW status updated for ${updatedIds.size} media.`);
            } else {
                showGlobalError('Failed to update NSFW status, try again later.', true);
            }
        });
    };

    const changeBulkCategory = (selectedItems, categoryId) => {
        window.api.changeBulkMediaCategory(selectedItems, categoryId).then((response) => {
            if (response.status === responseStatus.SUCCESS || response.data?.status === 'partial') {
                const updatedIds = new Set(response.data.mediaUpdated);
                setMediaList((prevState) => ({
                    listName: prevState.listName,
                    list: prevState.list.map((item) => {
                        if (updatedIds.has(item.id)) {
                            return { ...item, categoryId: categoryId };
                        }
                        return item;
                    }),
                }));
                showGlobalNotification(`Category updated for ${updatedIds.size} media.`);
            } else {
                showGlobalError('Failed to update category, try again later.', true);
            }
        });
    };

    const changeBulkCollection = (selectedItems, newCollection) => {
        if (
            !window.confirm(
                `Are you sure you want to move the selected ${selectedItems.length} media to a ${newCollection.label} collection?`,
            )
        ) {
            return;
        }

        window.api.changeBulkMediaCollection(selectedItems, newCollection.id).then((response) => {
            if (response.status === responseStatus.SUCCESS || response.data?.status === 'partial') {
                const movedIds = new Set(response.data.mediaUpdated);
                const failedCount = response.data.mediaFailed?.length || 0;

                removeBulkSelectedItems(bulkSelectedItems, response.data.mediaUpdated);

                if (failedCount === 0) {
                    showGlobalNotification(`Moved ${movedIds.size} media to new collection successfully.`);
                } else {
                    // Check if failures were due to collection limit
                    const limitErrors = response.data.errorDetails?.filter((e) => e.reason === 'collection_limit_reached') || [];
                    const otherErrors = failedCount - limitErrors.length;

                    let message = `Moved ${movedIds.size} of ${selectedItems.length} media.`;
                    if (limitErrors.length > 0) {
                        message += ` ${limitErrors.length} could not be moved — target collection is at its 1000-item limit.`;
                    }
                    if (otherErrors > 0) {
                        message += ` ${otherErrors} failed due to an unexpected error.`;
                    }
                    showGlobalError(message, true);
                }
            } else {
                showGlobalError(response.message, true);
            }
        });
    };

    const handleBulkImportProgress = (stream) => {
        if (stream.event !== mainThreadEvents.ON_BULK_IMPORT_TO_COLLECTION_PROCESS) return;

        const { status, progress, error, result } = stream.data;

        if (status === batchProcessStates.ERROR) {
            showGlobalError(error);
            return;
        }

        if (status === batchProcessStates.COMPLETE) {
            removeBulkSelectedItems(bulkSelectedItems, result.imported || []);
            showGlobalNotification(`Bulk import to collection completed with ${result.imported.length} files.`);
            window.api.stop(ipcChannels.EVENT_STREAM, handleBulkImportProgress);
        }
    };

    // Remove the removed  items.
    const removeBulkSelectedItems = (bulkSelectedItems, itemIdsToRemove) => {
        const itemIdToRemoveSet = new Set(itemIdsToRemove);
        const updatedMediaArr = mediaList.list.filter((item) => !itemIdToRemoveSet.has(item.id));

        const lastMovedIndex = Math.max(...bulkSelectedItems.map((item) => mediaList.list.findIndex((m) => m.id === item.id)));
        const nextIndex = Math.min(lastMovedIndex, updatedMediaArr.length - 1);
        if (updatedMediaArr[nextIndex]) {
            onMediaFileSelection(updatedMediaArr[nextIndex]);
        }
        setBulkSelectedIds([]);

        setMediaList({ listName: currentCollection.label, list: updatedMediaArr });
    };

    /**
     * This is for watchfolders
     * @param {*} selectedItems
     * @param {*} collectionId
     * @returns
     */
    const bulkImportToCollection = (selectedItems, newCollection) => {
        window.api.receive(ipcChannels.EVENT_STREAM, handleBulkImportProgress);
        window.api.bulkImportToCollection(selectedItems, newCollection).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                showGlobalNotification(`Import process started. It may take some time to complete.`);
            } else {
                alert(response.message || 'Bulk import is already in progress');
            }
        });
    };

    const resetBulkMetaData = (selectedItems, metaDataList = []) => {
        window.api.resetBulkMediaMetadata(selectedItems, metaDataList).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                showGlobalNotification(`Metadata reset done for the selected items`);
            } else {
                showGlobalError(`Failed to reset metadata. \n Error: ${response.message} `);
            }
        });
    };

    const onBulkDetailsChange = ({ change, data }) => {
        switch (change) {
            case 'delete':
                deleteBulkMedia(data.mediaList);
                break;
            case 'isNsfw':
                changeBulkNsfwStatus(data.mediaList, data.isNsfw);
                break;
            case 'category':
                changeBulkCategory(data.mediaList, data.categoryId);
                break;
            case 'switchCollection':
                changeBulkCollection(data.mediaList, data.newCollection);
                break;
            case 'importToCollection':
                bulkImportToCollection(data.mediaList, data.newCollection);
                break;
            case 'resetMetaData':
                resetBulkMetaData(data.mediaList, data.metaDataList);
                break;
            default:
        }
    };

    const refreshCollectionList = () => {
        setIsRefreshInProgress(true);

        window.api.refreshWatchFolder(currentCollection.id).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                fetchFreshDetailsAndSetState(currentCollection);
                setIsRefreshInProgress(false);
                showGlobalNotification('Watch folder refreshed successfully.');
            }
        });
    };

    useEffect(() => {
        if (sortOption) {
            const sortedMediaList = sortVideoList(mediaList.list, sortOption);
            setMediaList({ listName: mediaList.label, list: sortedMediaList });
        }
    }, [sortOption]);

    return {
        currentMediaDetails,
        mediaList,
        // bulk
        bulkSelectedIds,
        setBulkSelectedIds,
        isBulkMode,
        bulkSelectedItems,
        onBulkDetailsChange,
        //
        viewType,
        changeViewType,
        onMediaFileSelection,
        onSortingChange,
        onCollectionDelete,
        onMediaDelete,
        onAnyVideoDetailsChange,
        refreshCollectionList,
        isRefreshInProgress,
        onAnyImageDetailsChange,

        onAnyAudioDetailsChange,
    };
};

export default useCollectionDetailsAction;
