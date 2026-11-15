import { useEffect, useMemo, useState } from 'react';
import style from './Collections.css';

const EXPANDED_YEARS_SETTING_KEY = 'fileCollectionExpandedYears';

const useFileCollectionList = ({
    collection,
    isSingleCollection,
    selectedItemId,
    collectionToReveal,
    onToggleCollapse,
    yearCollapseThreshold,
}) => {
    const [expandedYears, setExpandedYears] = useState({});

    const collectionWrapperClass = isSingleCollection ? style.singleCollectionWrapper : style.collectionWrapper;
    const shouldCollapseYears = collection.length >= yearCollapseThreshold;

    const collectionWithYear = useMemo(() => {
        if (collection.length === 0) return [];

        const collectionWithYearTemp = collection.reduce((acc, item) => {
            const year = item.year;
            if (!acc.has(year)) {
                acc.set(year, { year, items: [] });
            }
            acc.get(year).items.push(item);
            return acc;
        }, new Map());

        return Array.from(collectionWithYearTemp.values());
    }, [collection]);

    const collectionToRevealYear = useMemo(() => {
        if (!collectionToReveal?.id) return null;

        const collectionItemToReveal = collection.find((item) => item.id === collectionToReveal.id);
        return collectionItemToReveal ? collectionItemToReveal.year : null;
    }, [collection, collectionToReveal]);

    useEffect(() => {
        if (!shouldCollapseYears) return;

        let isMounted = true;

        window.api.getApplicationSettings(EXPANDED_YEARS_SETTING_KEY).then((savedExpandedYears) => {
            if (!isMounted) return;

            const nextExpandedYears =
                savedExpandedYears && typeof savedExpandedYears === 'object' && !Array.isArray(savedExpandedYears)
                    ? { ...savedExpandedYears }
                    : {};

            if (collectionToRevealYear !== null) {
                nextExpandedYears[collectionToRevealYear] = true;
                window.api.setApplicationSettings(EXPANDED_YEARS_SETTING_KEY, nextExpandedYears);
            }

            setExpandedYears(nextExpandedYears);
        });

        return () => {
            isMounted = false;
        };
    }, [collectionToReveal?.id, collectionToRevealYear, shouldCollapseYears]);

    const handleToggleCollapse = () => {
        if (onToggleCollapse) {
            onToggleCollapse();
        }
    };

    const toggleYear = (year) => {
        setExpandedYears((currentExpandedYears) => {
            const nextExpandedYears = {
                ...currentExpandedYears,
                [year]: !currentExpandedYears[year],
            };

            if (shouldCollapseYears) {
                window.api.setApplicationSettings(EXPANDED_YEARS_SETTING_KEY, nextExpandedYears);
            }

            return nextExpandedYears;
        });
    };

    const getYearExpandedState = (year) => {
        if (!shouldCollapseYears) return true;
        return expandedYears[year] === true;
    };

    const getCollectionItemClassName = (item) => {
        const isSelectedItem = selectedItemId && selectedItemId === item.id;
        return `${style.collectionListItem} ${style.file} ${isSelectedItem && style.selectedItem} ${item.isHidden && style.isHidden}`;
    };

    return {
        collectionWrapperClass,
        collectionWithYear,
        getCollectionItemClassName,
        getYearExpandedState,
        handleToggleCollapse,
        shouldCollapseYears,
        toggleYear,
    };
};

export default useFileCollectionList;
