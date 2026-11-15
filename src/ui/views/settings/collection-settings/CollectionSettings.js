import React, { useMemo, useState } from 'react';

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

const getYears = (collections) => {
    let years = new Set(collections.map((item) => item.year));
    return [...years] || [];
};

const MIN_REGULAR_COLLECTION_LENGTH = 200;

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
    const [openNewCollection, setOpenNewCollection] = useState(false);
    const [filteredYear, setFilteredYear] = useState(null);

    const isYearFilterApplicable = stateContext.collections.length > MIN_REGULAR_COLLECTION_LENGTH;
    const applicableYears = useMemo(() => {
        if (!isYearFilterApplicable) return [];
        return getYears(stateContext.collections);
    }, [stateContext.collections, isYearFilterApplicable]);

    const hideHiddenCollections = Boolean(stateContext?.userPreferences?.hideHiddenCollections);
    const showHiddenCollection = !hideHiddenCollections;

    const collectionsList = useMemo(() => {
        let collectionsToBeShown = cloneDeep(stateContext.collections);
        const effectiveFilteredYear = parseInt(filteredYear || applicableYears[0]);

        if (effectiveFilteredYear) {
            collectionsToBeShown = collectionsToBeShown.filter((item) => item.year === effectiveFilteredYear);
        }

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

        return collectionsToBeShown;
    }, [stateContext.collections, applicableYears, filteredYear, showHiddenCollection, textToFilter, sortingOrder]);

    const onTextFilter = (str) => {
        str = str.trim().toLowerCase();
        setTextToFilter(str);
    };

    const onSortingChange = (order) => {
        setSortingOrder(order);
    };

    const onYearSelectorChange = (year) => {
        setFilteredYear(year);
    };

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
                    {isYearFilterApplicable && (
                        <select
                            className={formStyles.formSelectBox}
                            onChange={(e) => onYearSelectorChange(e.target.value)}
                            defaultValue={applicableYears[0]}
                        >
                            {applicableYears.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    )}

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
