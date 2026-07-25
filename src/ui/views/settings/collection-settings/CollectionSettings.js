import React, { useEffect, useState } from 'react';

import settingsStyle from '../Settings.css';
import formStyles from '__styles/forms.css';
import { useApplicationContext } from '__contexts/app.context';

import CollectionList from './CollectionList';
import {
    HeaderControlBar,
    HeaderControlBarRight,
    HeaderControlBarLeft,
} from '__components/core-components/header-control-bar/HeaderControlBar';
import InputFilter from '__components/core-components/input-filter/InputFilter';
import SortingSelector from '__components/core-components/sorting-selector/SortingSelector';

import AddNewCollection from '__components/add-collection/AddNewCollection';
import Button from '__components/core-components/button/Button';
import cloneDeep from '__utils/cloneDeep';
import sortBy from '__utils/sortBy';
import applicationEvents from '__events/applicationEvents';

/**
 * Collections object
 * [
 *  {
 *      "id" : '92837465235',
 *      "label": '2021__my-collection',
 *      "hidden": false,
 *      'year': 2021
 *  }
 * ]
 * @returns {JSX.Element}
 * @constructor
 */
const CollectionSettings = () => {
    const [stateContext, dispatchContext] = useApplicationContext();
    const [textToFilter, setTextToFilter] = useState('');
    const [sortingOrder, setSortingOrder] = useState('');
    const [collectionsList, setCollectionsList] = useState(stateContext.collections);
    const [openNewCollection, setOpenNewCollection] = useState(false);

    const hideHiddenCollections = Boolean(stateContext?.userPreferences?.hideHiddenCollections);
    const showHiddenCollection = !hideHiddenCollections;

    const onTextFilter = (str) => {
        str = str.trim().toLowerCase();
        setTextToFilter(str);
    };

    const onSortingChange = (order) => {
        setSortingOrder(order);
    };

    /**
     * Apply all filtering and sorting logic
     */
    useEffect(() => {
        if (stateContext.collections) {
            let collectionsToBeShown = cloneDeep(stateContext.collections);

            if (!showHiddenCollection) {
                collectionsToBeShown = collectionsToBeShown.filter((item) => item.isHidden !== 1 && item.isHidden !== true);
            }

            if (textToFilter !== '') {
                collectionsToBeShown = collectionsToBeShown.filter((item) => item.label.toLowerCase().includes(textToFilter));
            }

            if (sortingOrder === 'A-Z') {
                collectionsToBeShown = sortBy(collectionsToBeShown, 'label');
            }

            if (sortingOrder === 'Z-A') {
                collectionsToBeShown = sortBy(collectionsToBeShown, 'label').reverse();
            }

            setCollectionsList(collectionsToBeShown);
        }
    }, [stateContext.collections, showHiddenCollection, textToFilter, sortingOrder]);

    const onNewCollectionAdded = () => {
        setOpenNewCollection(false);
    };

    const onToggleHiddenCollection = (event) => {
        const shouldShowHiddenCollections = event.target.checked;
        window.api.setUserPreference('hideHiddenCollections', !shouldShowHiddenCollections).then((updatedPreferences) => {
            dispatchContext({
                type: applicationEvents.USER_PREFERENCE_UPDATE,
                payload: {
                    userPreferences: updatedPreferences,
                },
            });
        });
    };

    return (
        <>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3 title="Collections are physical folders where videos are organized.">Your Collections</h3>
                </HeaderControlBarLeft>
                <HeaderControlBarRight>
                    <InputFilter onChange={onTextFilter} />
                    <SortingSelector
                        options={[
                            { value: 'A-Z', label: 'A-Z' },
                            { value: 'Z-A', label: 'Z-A' },
                        ]}
                        placeholder={'Sort collections'}
                        onChange={onSortingChange}
                    />
                </HeaderControlBarRight>
            </HeaderControlBar>
            <CollectionList collections={collectionsList} />
            <div className={formStyles.formInputWrapper}>
                <div className={formStyles.formSwitch}>
                    <input
                        type="checkbox"
                        id="showHiddenCollectionsToggle"
                        checked={showHiddenCollection}
                        onChange={onToggleHiddenCollection}
                    />
                    <label htmlFor="showHiddenCollectionsToggle" className={formStyles.formSwitchToggle}></label>
                    <label htmlFor="showHiddenCollectionsToggle">Show hidden collections</label>
                </div>
            </div>
            <div className={settingsStyle.settingsFooterActions}>
                <Button onClick={() => setOpenNewCollection(true)}>Add new collection</Button>
                {openNewCollection && <AddNewCollection onCollectionAdd={onNewCollectionAdded} />}
            </div>
        </>
    );
};

export default CollectionSettings;
