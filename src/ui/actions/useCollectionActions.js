// this is an action hook, that will control all the event actions of modifying the actions

import { useEffect, useState } from 'react';

import { useApplicationContext } from '__contexts/app.context';
import applicationEvents from '__events/applicationEvents';
import { showGlobalNotification } from '__contexts/AppNotificationContext';

const useCollectionActions = () => {
    const [stateContext, dispatchEvent] = useApplicationContext();
    const [collections, setCollections] = useState([]);

    const [addCollectionResponse, setAddCollectionResponse] = useState(null);
    /**
     * Add collection is fired to add a new item to the collection
     * @param {*} collection
     */
    const addNewCollection = (year, label, isHidden) => {
        setAddCollectionResponse('');

        window.api.addNewCollection(year, label, isHidden).then((response) => {
            if (response?.status == 'success') {
                dispatchEvent({
                    type: applicationEvents.COLLECTIONS_UPDATE,
                    payload: { collections: response.data },
                });
                showGlobalNotification(`A new collection ${label} added to your library.`);
                setAddCollectionResponse(response);
            } else {
                alert(response.message);
            }
        });
    };

    /**
     * Remove collection is fired to remove an item from the collection
     * @param {*} collectionId
     */
    const removeCollection = (collectionId) => {
        window.api.removeCollection(collectionId).then((response) => {
            if (response?.status == 'success') {
                dispatchEvent({
                    type: applicationEvents.COLLECTIONS_UPDATE,
                    payload: { collections: response.data },
                });
            } else {
                alert(response.message);
            }
        });
    };

    /**
     * Rename collection is fired to rename an item in the collection
     * @param {*} collectionId
     * @param {*} newName
     */
    const renameCollection = (collectionId, newName) => {
        window.api.renameCollection(collectionId, newName).then((response) => {
            if (response?.status == 'success') {
                dispatchEvent({
                    type: applicationEvents.COLLECTIONS_UPDATE,
                    payload: { collections: response.data },
                });
            } else {
                alert('Failed to rename collection', response.message);
            }
        });
    };

    const hideCollection = (collectionId) => {
        window.api.hideCollection(collectionId).then((response) => {
            if (response?.status == 'success') {
                dispatchEvent({
                    type: applicationEvents.COLLECTIONS_UPDATE,
                    payload: { collections: response.data },
                });
            } else {
                alert(response.message);
            }
        });
    };

    const unhideCollection = (collectionId) => {
        window.api.unhideCollection(collectionId).then((response) => {
            if (response?.status == 'success') {
                dispatchEvent({
                    type: applicationEvents.COLLECTIONS_UPDATE,
                    payload: { collections: response.data },
                });
            } else {
                alert(response.message);
            }
        });
    };

    useEffect(() => {
        setCollections(stateContext.collections);
    }, [stateContext.collections]);

    return {
        addNewCollection,
        removeCollection,
        renameCollection,
        collections,
        addCollectionResponse,
        hideCollection,
        unhideCollection,
    };
};

export default useCollectionActions;
