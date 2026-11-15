import React, { useEffect, useRef } from 'react';
import CollectionIcon from '__components/core-components/icons/CollectionIcon';
import style from './Collections.css';
import systemConfig from '__configs/systemConfig';
import useFileCollectionList from './useFileCollectionList';

const DEFAULT_YEAR_COLLAPSE_THRESHOLD = 100;

const getYearLabel = (year) => (year === systemConfig.DEFAULT_COLLECTION_YEAR ? '🦕 Ice Age' : year);
const getYearAriaLabel = (year) => (year === systemConfig.DEFAULT_COLLECTION_YEAR ? 'Ice Age' : year);

const FileCollectionList = ({
    collection = [],
    onCollectionItemClick = () => {},
    collectionHeader = '',
    isSingleCollection = false,
    selectedItemId = null,
    collectionToReveal = null,
    collectionsName = '',
    contextMenuClick,
    collectionItemContextMenuClick,
    headerControls = null,
    isCollapsed = false,
    onToggleCollapse = null,
    onCollectionDoubleClick = () => {},
    yearCollapseThreshold = DEFAULT_YEAR_COLLAPSE_THRESHOLD,
}) => {
    const {
        collectionWrapperClass,
        collectionWithYear,
        getCollectionItemClassName,
        getYearExpandedState,
        handleToggleCollapse,
        shouldCollapseYears,
        toggleYear,
    } = useFileCollectionList({
        collection,
        isSingleCollection,
        selectedItemId,
        collectionToReveal,
        onToggleCollapse,
        yearCollapseThreshold,
    });

    const collectionsWrapperRef = useRef(null);

    useEffect(() => {
        if (!collectionToReveal?.id || isCollapsed) return;

        // Defer the scroll by one macrotask so year expansion/layout changes can settle.
        const scrollTimeoutId = setTimeout(() => {
            const collectionItemElement = collectionsWrapperRef.current?.querySelector(`[data-id="${collectionToReveal.id}"]`);

            collectionItemElement?.scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'nearest',
            });
        }, 1);

        return () => clearTimeout(scrollTimeoutId);
    }, [collectionToReveal?.id, collectionWithYear, isCollapsed]);

    return (
        <>
            <div className={style.collections} ref={collectionsWrapperRef}>
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
                    collectionWithYear.map((collections) => {
                        const isYearExpanded = getYearExpandedState(collections.year);

                        return (
                            <div key={`${collections.year}_year`}>
                                {!isNaN(collections.year) && (
                                    <div
                                        className={`${style.collectionYearLabel} ${shouldCollapseYears ? style.collapsibleYearLabel : ''}`}
                                        showcaret={isYearExpanded ? 'false' : 'true'}
                                        role={shouldCollapseYears ? 'button' : undefined}
                                        aria-expanded={shouldCollapseYears ? isYearExpanded : undefined}
                                        aria-label={
                                            shouldCollapseYears
                                                ? `${isYearExpanded ? 'Collapse' : 'Expand'} ${getYearAriaLabel(collections.year)} collections, ${
                                                      collections.items.length
                                                  } items`
                                                : undefined
                                        }
                                        onClick={shouldCollapseYears ? () => toggleYear(collections.year) : undefined}
                                        onKeyDown={
                                            shouldCollapseYears
                                                ? (e) => {
                                                      if (e.key === 'Enter' || e.key === ' ') {
                                                          e.preventDefault();
                                                          toggleYear(collections.year);
                                                      }
                                                  }
                                                : undefined
                                        }
                                        tabIndex={shouldCollapseYears ? 0 : undefined}
                                    >
                                        {getYearLabel(collections.year)}
                                        <span className={style.collectionYearCount}>({collections.items.length})</span>
                                    </div>
                                )}
                                {isYearExpanded && (
                                    <ul className={collectionWrapperClass}>
                                        {collections.items.map((item) => (
                                            <li
                                                className={getCollectionItemClassName(item)}
                                                key={item.id}
                                                data-id={item.id}
                                                title={`${item.year}/${item.label}`}
                                                onClick={() => onCollectionItemClick(item, collectionsName)}
                                                onDoubleClick={() => onCollectionDoubleClick(item)}
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
                                                <CollectionIcon isInline={true} />
                                                <span className={style.collectionlabel}>{item.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
            </div>
        </>
    );
};

export default FileCollectionList;
