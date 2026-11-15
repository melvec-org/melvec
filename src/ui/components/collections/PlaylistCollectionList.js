import React from 'react';
import style from './Collections.css';
import PlaylistIcon from '__components/core-components/icons/PlaylistIcon';

const PlaylistCollectionList = ({
    collection = [],
    onCollectionItemClick = () => {},
    collectionHeader = '',
    isSingleCollection = false,
    selectedItemId = null,
    collectionsName = '',
    contextMenuClick,
    collectionItemContextMenuClick,
    headerControls = null,
    isCollapsed = false,
    onToggleCollapse = null,
    onCollectionDoubleClick = () => {},
}) => {
    let collectionWrapperClass = isSingleCollection ? style.singleCollectionWrapper : style.collectionWrapper;

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

                {!isCollapsed && (
                    <ul className={collectionWrapperClass}>
                        {collection.map((item) => {
                            const isSelectedItem = selectedItemId && selectedItemId === item.id;
                            const listClass = `${style.collectionListItem} ${isSelectedItem && style.selectedItem} ${
                                item.isHidden && style.isHidden
                            }`;

                            return (
                                <li
                                    className={listClass}
                                    key={item.id}
                                    title={item.label}
                                    onClick={() => onCollectionItemClick(item, collectionsName)}
                                    onDoubleClick={() => onCollectionDoubleClick(item)}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            onCollectionItemClick(item, collectionsName);
                                        }
                                    }}
                                    onContextMenu={(e) => collectionItemContextMenuClick && collectionItemContextMenuClick(e, item)}
                                >
                                    <PlaylistIcon isInline={true} />
                                    <span className={style.collectionlabel}>{item.label}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </>
    );
};

export default PlaylistCollectionList;
