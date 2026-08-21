import React, { useEffect, useState } from 'react';
import AllCollectionsLayout from '__components/layouts/AllCollectionsLayout';
import Sidebar from '__components/layouts/Sidebar';
import MainPanel from '__components/layouts/MainPanel';
import Collections from '__components/collections/Collections';
import CollectionDetails from './video-list-browser/CollectionDetails';
import { useApplicationContext } from '../../contexts/app.context';
import LibraryCollection from './LibraryCollection';
import ResizableSidePanel from '__components/resizable-panel/ResizableSidePanel';

const AllCollections = () => {
    const [stateContext] = useApplicationContext();

    const [selectedCollectionAndVideo, setSelectedCollectionAndVideo] = useState(null);
    const [currentVisibleCollections, setCurrentVisibleCollections] = useState([]);

    const watchFolders = stateContext.watchFolders;

    // const [filteredCollections, setFilteredCollections] = useState([stateContext.collections]);

    const onCollectionItemClick = (item, isExternal) => {
        item.isExternal = isExternal;
        setSelectedCollectionAndVideo({
            selectedCollection: item,
            selectedVideoId: null,
        });
    };

    /** NOTES:
     * This following use case is useful when coming to browser page from a different source
     * For internal switching within the browser page, you need not make a global context change
     *
     * selectedCollectionAndVideo can be null for first time when you are coming to browser page
     * from some other page by searching for a video
     *
     * There are other two possible scenarios:
     * 1. When you have different selectedCollectionAndVideo.selectedCollection in selection and you want to jump
     * 2. When you are in the same collection but want to jump to a different video
     *
     */
    useEffect(() => {
        const selectedCollection = stateContext?.currentBrowserState?.selectedCollection;

        if (selectedCollection) {
            if (selectedCollectionAndVideo === null || selectedCollection) {
                const newCollectionAndVideo = {
                    selectedCollection: selectedCollection,
                    selectedVideoId: stateContext?.currentBrowserState?.selectedVideoId || null,
                };
                window.api.setApplicationSettings('lastBrowserState', newCollectionAndVideo);
                setSelectedCollectionAndVideo(newCollectionAndVideo);
            }
        }
    }, [stateContext?.currentBrowserState?.selectedCollection, stateContext?.currentBrowserState?.selectedVideoId]);

    useEffect(() => {
        // do a filteration first time.
        let filteredData = [];

        if (stateContext.hideHiddenCollections) {
            filteredData = stateContext.collections.filter((collection) => !collection.isHidden);
        } else {
            filteredData = stateContext.collections;
        }
        setCurrentVisibleCollections(filteredData);
        // currentVisibleCollections can be some collection if stateContext?.currentBrowserState contains any val
        // so check if currentVisibleCollections is null, then check from application Settings to avoid execution
        if (selectedCollectionAndVideo === null) {
            window.api.getApplicationSettings('lastBrowserState').then((data) => {
                // If last selected collection exists in the current state, set it as the current collection
                // check for the collection in the library collection and in the watch folders
                // There are probability that the watch folders does not exist
                if (data === null || data.selectedCollection === undefined) {
                    setSelectedCollectionAndVideo({
                        selectedCollection: filteredData[0] || null,
                        selectedVideoId: data?.selectedVideoId || null,
                    });
                } else if (data.selectedCollection !== undefined) {
                    const lastSelectedCollection = data.selectedCollection;
                    const doesCollectionExist = filteredData.some((collection) => collection.id === lastSelectedCollection.id);
                    const doesExistInwatchFolders = watchFolders.some((folder) => folder.id === lastSelectedCollection.id);

                    if (doesCollectionExist || doesExistInwatchFolders) {
                        setSelectedCollectionAndVideo({
                            selectedCollection: lastSelectedCollection,
                            selectedVideoId: data.selectedVideoId || null,
                        });
                    } else {
                        setSelectedCollectionAndVideo({
                            selectedCollection: filteredData[0],
                            selectedVideoId: data.selectedVideoId || null,
                        });
                    }
                }
            });
        }
    }, []);

    useEffect(() => {
        if (stateContext?.userPreferences?.hideHiddenCollections) {
            const filteredCollections = stateContext.collections.filter((collection) => !collection.isHidden);
            setCurrentVisibleCollections(filteredCollections);

            setSelectedCollectionAndVideo({
                selectedCollection: filteredCollections[0],
                selectedVideoId: null,
            });
        } else {
            setCurrentVisibleCollections(stateContext.collections);
        }
    }, [stateContext.collections, stateContext?.userPreferences?.hideHiddenCollections]);

    return (
        <AllCollectionsLayout>
            {selectedCollectionAndVideo !== null && (
                <>
                    <ResizableSidePanel maxWidth={400} minWidth={250} initialWidth={240} direction="right" panelId="allCollectionSidebar">
                        <Sidebar headerLabel={'All Collections'}>
                            {currentVisibleCollections.length > 0 && (
                                <LibraryCollection
                                    collections={currentVisibleCollections}
                                    onCollectionItemClick={(item) => onCollectionItemClick(item, false)}

                                    selectedItemId={selectedCollectionAndVideo.selectedCollection.id}
                                />
                            )}

                            {watchFolders.length > 0 && (
                                <Collections
                                    collection={watchFolders}
                                    collectionHeader="Watch folders"
                                    onCollectionItemClick={(item) => onCollectionItemClick(item, true)}

                                    selectedItemId={selectedCollectionAndVideo.selectedCollection.id}
                                />
                            )}
                        </Sidebar>
                    </ResizableSidePanel>

                    <MainPanel>
                        <CollectionDetails
                            selectedCollection={selectedCollectionAndVideo.selectedCollection}
                            selectedVideoId={selectedCollectionAndVideo.selectedVideoId}
                        />
                    </MainPanel>
                </>
            )}
        </AllCollectionsLayout>
    );
};

export default AllCollections;
