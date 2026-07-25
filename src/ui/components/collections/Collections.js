import React, { useEffect, useState } from 'react';
import CollectionIcon from '__components/core-components/icons/CollectionIcon';
import style from './Collections.css';
import PlaylistIcon from '__components/core-components/icons/PlaylistIcon';
import systemConfig from '__configs/systemConfig';

const Collections = ({
    collection = [],
    onCollectionItemClick = null,
    collectionHeader = '',
    collectionType = 'file',
    isSingleCollection = false,
    selectedItemId = null,
    collectionsName = '',
    contextMenuClick,
    collectionItemContextMenuClick,
    headerControls = null,
    isCollapsed = false,
    onToggleCollapse = null,
}) => {
    let collectionWrapperClass = isSingleCollection ? style.singleCollectionWrapper : style.collectionWrapper;
    const [collectionWithYear, setCollectionWithYear] = useState([]);

    useEffect(() => {
        if (collection.length > 0 && collectionType === 'file') {
            const collectionWithYearTemp = collection.reduce((acc, item) => {
                const year = item.year;
                if (!acc[year]) {
                    acc[year] = { year, items: [] };
                }
                acc[year].items.push(item);
                return acc;
            }, {});
            const collectionWithYear = Object.values(collectionWithYearTemp);

            setCollectionWithYear(collectionWithYear);
        } else {
            setCollectionWithYear([{ year: 0, items: collection }]);
        }
    }, [collection, collectionType]);

    const handleToggleCollapse = () => {
        if (onToggleCollapse) {
            onToggleCollapse();
        }
    };

    return (
        <>
            <div className={style.collections}>
                <div className={style.collectionHeader} onContextMenu={contextMenuClick} showcaret={isCollapsed ? 'true' : 'false'}>
                    <div
                        className={style.collectionHeaderText}
                        onClick={handleToggleCollapse}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleToggleCollapse();
                            }
                        }}
                        tabIndex={0}
                    >
                        {collectionHeader}
                    </div>
                    <div className={style.collectionHeaderControls}>{headerControls}</div>
                </div>

                {!isCollapsed &&
                    collectionWithYear.map((collections) => (
                        <div key={`${collections.year}_year`}>
                            {!isNaN(collections.year) && collectionType === 'file' && (
                                <div className={style.collectionYearLabel}>
                                    {collections.year === systemConfig.DEFAULT_COLLECTION_YEAR ? '🦕 Ice Age' : collections.year}
                                </div>
                            )}
                            <ul className={collectionWrapperClass}>
                                {collections.items[0] &&
                                    collections.items.map((item) => {
                                        const isSelectedItem = selectedItemId && selectedItemId === item.id;
                                        const listClass = `${style.collectionListItem} ${style[collectionType]} ${
                                            isSelectedItem && style.selectedItem
                                        } ${item.isHidden && style.isHidden}`;

                                        return (
                                            <li
                                                className={listClass}
                                                key={item.id}
                                                title={`${item.year}/${item.label}`}
                                                onClick={() => onCollectionItemClick(item, collectionsName)}
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        onCollectionItemClick(item, collectionsName);
                                                    }
                                                }}
                                                onContextMenu={(e) =>
                                                    collectionItemContextMenuClick && collectionItemContextMenuClick(e, item)
                                                }
                                            >
                                                {collectionType === 'play' && <PlaylistIcon isInline={true} />}
                                                {collectionType === 'file' && <CollectionIcon isInline={true} />}
                                                <span className={style.collectionlabel}>{item.label}</span>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    ))}
            </div>
        </>
    );
};

export default Collections;
