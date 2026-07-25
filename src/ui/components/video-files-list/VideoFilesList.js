import React, { useEffect, useRef, useState } from 'react';
import Thumbnail from '../core-components/thumbnail/Thumbnail';
import style from './VideoFilesList.css';
import { useApplicationContext } from '../../contexts/app.context';
import onMissingThumbnailFound from '../../utils/thumbnailCreationService';
import { formatTime } from '__utils/timeUtils';
import keyCodes from '__constants/keyCodes';
import mediaTypes from '__constants/mediaTypes';

const lastBrowsedIndexCache = new Map();

/**
 * Returns the next item in a linear list, wrapping to the beginning.
 *
 * @param {Array<{id: string|number}>} list - Collection of items.
 * @param {string|number} selectedItemId - Currently selected item id.
 * @param {number} [step=1] - Number of positions to move forward.
 * @returns {Object|undefined} The next item or undefined when list is empty.
 */
const getNextSelectionId = (list, selectedItemId, step = 1) => {
    const currentIndex = list.findIndex((item) => item.id === selectedItemId);

    if (list.length === 0) return undefined;
    if (currentIndex === -1) return list[0];

    const nextIndex = (currentIndex + step) % list.length;
    return list[nextIndex];
};

/**
 * Returns the previous item in a linear list, wrapping to the end.
 *
 * @param {Array<{id: string|number}>} list - Collection of items.
 * @param {string|number} selectedItemId - Currently selected item id.
 * @param {number} [step=1] - Number of positions to move backward.
 * @returns {Object|undefined} The previous item or undefined when list is empty.
 */
const getPreviousSelectionId = (list, selectedItemId, step = 1) => {
    const currentIndex = list.findIndex((item) => item.id === selectedItemId);

    if (list.length === 0) return undefined;
    if (currentIndex === -1) return list[list.length - 1];

    const prevIndex = (((currentIndex - step) % list.length) + list.length) % list.length;
    return list[prevIndex];
};

/**
 * Returns the next item in a grid by moving one row down in the same column.
 * Wraps to the first row when reaching the bottom.
 *
 * @param {Array<{id: string|number}>} list - Collection of items.
 * @param {string|number} selectedItemId - Currently selected item id.
 * @param {number} itemsPerRow - Number of items rendered per row.
 * @returns {Object|undefined} The next grid item or undefined when list is empty.
 */
const getNextGridSelectionId = (list, selectedItemId, itemsPerRow) => {
    const len = list.length;
    if (len === 0) return undefined;

    const currentIndex = list.findIndex((item) => item.id === selectedItemId);
    if (currentIndex === -1) return list[0];

    const col = currentIndex % itemsPerRow;
    const rows = Math.ceil(len / itemsPerRow);
    const row = Math.floor(currentIndex / itemsPerRow);

    const nextRow = (row + 1) % rows;
    const nextIndex = nextRow * itemsPerRow + col;

    // If that column doesn't exist in the last row, wrap to first row same column.
    if (nextIndex >= len) {
        return list[col] ?? list[0];
    }
    return list[nextIndex];
};

/**
 * Returns the previous item in a grid by moving one row up in the same column.
 * Wraps to the last available row/item in that column when needed.
 *
 * @param {Array<{id: string|number}>} list - Collection of items.
 * @param {string|number} selectedItemId - Currently selected item id.
 * @param {number} itemsPerRow - Number of items rendered per row.
 * @returns {Object|undefined} The previous grid item or undefined when list is empty.
 */
const getPreviousGridSelectionId = (list, selectedItemId, itemsPerRow) => {
    const len = list.length;
    if (len === 0) return undefined;

    const currentIndex = list.findIndex((item) => item.id === selectedItemId);
    if (currentIndex === -1) return list[len - 1];

    const col = currentIndex % itemsPerRow;
    const rows = Math.ceil(len / itemsPerRow);
    const row = Math.floor(currentIndex / itemsPerRow);

    const prevRow = (row - 1 + rows) % rows;
    const prevIndex = prevRow * itemsPerRow + col;

    // If that column doesn't exist in the last row, go to last available in that column.
    if (prevIndex >= len) {
        const lastRowStart = (rows - 1) * itemsPerRow;
        const lastRowCount = len - lastRowStart;
        const fallbackIndex = lastRowStart + Math.min(col, lastRowCount - 1);
        return list[fallbackIndex] ?? list[len - 1];
    }
    return list[prevIndex];
};

/**
 * Renders a selectable list/grid of video items with keyboard navigation and bulk selection.
 *
 * Features:
 * - list and grid rendering modes
 * - arrow-key navigation
 * - enter-to-open behavior
 * - delete/backspace callback support
 * - remembers last selected item per list name
 * - triggers thumbnail regeneration when an image is missing
 * - bulk selection via Shift+Click or Shift+Arrow keys
 * - plain click or plain arrow key exits bulk mode
 * - Escape clears bulk selection
 *
 * @param {Object} props - Component props.
 * @param {Array<Object>} [props.list=[]] - Video items to render.
 * @param {'list'|'grid'} [props.view='list'] - Display mode.
 * @param {Function} props.onListItemClick - Called when an item is selected.
 * @param {Function} props.onListItemEnterPress - Called when Enter is pressed on an item.
 * @param {string} [props.listName=''] - Cache key used to remember last selected item for the list.
 * @param {boolean} [props.isExternal=false] - Whether items come from an external source path.
 * @param {Object} [props.preSelectedItem] - Optional item to force as selected.
 * @param {Function} props.onMediaDelete - Called when Delete/Backspace is pressed. Receives a single id or array of ids in bulk mode.
 * @param {Function} [props.onBulkSelectionChange] - Called with an array of selected ids whenever bulk selection changes. Called with [] when bulk mode exits.
 * @returns {JSX.Element} Video files list UI.
 */
const VideoFilesList = ({
    list = [],
    view = 'list',
    onListItemClick,
    onListItemEnterPress,
    listName = '',
    isExternal = false,
    preSelectedItem,
    onMediaDelete,
    onBulkSelectionChange,
}) => {
    const [selectedItemId, setSelectedItemId] = useState(list[0]?.id || 0);
    const [stateContext] = useApplicationContext();
    const listRef = useRef(null);
    const [itemsPerRow, setItemsPerRow] = useState(1);

    // Bulk selection state
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    // Anchor is the item where Shift was first pressed — the range always extends from here
    const anchorIdRef = useRef(null);

    /**
     * Computes a Set of ids covering the range between anchorIdRef and the target item (inclusive).
     */
    const computeRange = (targetItem) => {
        const anchorIndex = list.findIndex((i) => i.id === anchorIdRef.current);
        const targetIndex = list.findIndex((i) => i.id === targetItem.id);
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        return new Set(list.slice(start, end + 1).map((i) => i.id));
    };

    /**
     * Shift+Click / Shift+Arrow: selects a contiguous range from the anchor to the target.
     * The anchor is pinned on the very first call (when bulk mode was off); subsequent calls
     * keep the same anchor so the range can be extended/shrunk freely.
     */
    const extendBulkSelection = (targetItem) => {
        if (!isBulkMode) {
            // Anchor is the item that was single-selected before Shift was held
            anchorIdRef.current = selectedItemId;
        }
        const range = computeRange(targetItem);
        setSelectedIds(range);
        setIsBulkMode(true);
        setSelectedItemId(targetItem.id);
    };

    /**
     * Exits bulk mode, reverts single selection to the anchor (first item in the range),
     * and clears all bulk selections.
     */
    const exitBulkMode = () => {
        if (anchorIdRef.current != null) {
            setSelectedItemId(anchorIdRef.current);
            lastBrowsedIndexCache.set(listName, anchorIdRef.current);
        }
        setIsBulkMode(false);
        setSelectedIds(new Set());
        anchorIdRef.current = null;
    };

    /**
     * Plain-click handler.
     * - Outside bulk mode: normal single-item selection; the clicked item becomes the anchor
     *   for any subsequent Shift+Click range.
     * - Inside bulk mode: toggles the clicked item in/out of the selection and updates the
     *   anchor so the next Shift+Click extends from here. Deselecting the last item exits
     *   bulk mode entirely.
     */
    const listItemClickHandler = (item) => {
        if (isBulkMode) {
            const next = new Set(selectedIds);
            if (next.has(item.id)) {
                next.delete(item.id);
            } else {
                next.add(item.id);
            }

            if (next.size === 0) {
                exitBulkMode();
            } else {
                setSelectedIds(next);
                setSelectedItemId(item.id);
                // Update anchor so the next Shift+Click range starts from here
                anchorIdRef.current = item.id;
            }
            return;
        }

        anchorIdRef.current = item.id;
        lastBrowsedIndexCache.set(listName, item.id);
        setSelectedItemId(item.id);
        onListItemClick(item);
    };

    // Notify parent whenever bulk selection changes
    useEffect(() => {
        if (onBulkSelectionChange) {
            onBulkSelectionChange(isBulkMode ? Array.from(selectedIds) : []);
        }
    }, [selectedIds, isBulkMode]);

    const getClassName = (item) => {
        const isSelected = isBulkMode ? selectedIds.has(item.id) : item.id === selectedItemId;
        return `${style.fileListItem}${isSelected ? ` ${style.selectedFileListItem}` : ''}`;
    };

    useEffect(() => {
        if (lastBrowsedIndexCache.get(listName)) {
            setSelectedItemId(lastBrowsedIndexCache.get(listName));
        } else {
            lastBrowsedIndexCache.set(listName, list[0]?.id);
            setSelectedItemId(list[0]?.id);
        }
    }, [listName]);

    useEffect(() => {
        if (preSelectedItem) {
            setSelectedItemId(preSelectedItem.id);
        }
    }, [preSelectedItem]);

    const onImageLoadError = (item) => {
        if (!isExternal) {
            onMissingThumbnailFound(item.id, `${stateContext.userPreferences.libraryPath}/${item.path}`, false, item.mediaType);
        } else {
            onMissingThumbnailFound(item.id, `${item.path}`, true, item.mediaType);
        }
    };

    const handleKeyUp = (event) => {
        // Resolve next item based on view and key pressed
        let nextItem = null;

        if (view === 'grid') {
            if (event.key === keyCodes.ARROW_DOWN) {
                nextItem = getNextGridSelectionId(list, selectedItemId, itemsPerRow);
            } else if (event.key === keyCodes.ARROW_UP) {
                nextItem = getPreviousGridSelectionId(list, selectedItemId, itemsPerRow);
            } else if (event.key === keyCodes.ARROW_RIGHT) {
                nextItem = getNextSelectionId(list, selectedItemId, 1);
            } else if (event.key === keyCodes.ARROW_LEFT) {
                nextItem = getPreviousSelectionId(list, selectedItemId, 1);
            }
        } else {
            if (event.key === keyCodes.ARROW_DOWN || event.key === keyCodes.ARROW_RIGHT) {
                nextItem = getNextSelectionId(list, selectedItemId, 1);
            } else if (event.key === keyCodes.ARROW_UP || event.key === keyCodes.ARROW_LEFT) {
                nextItem = getPreviousSelectionId(list, selectedItemId, 1);
            }
        }

        if (nextItem) {
            if (event.shiftKey) {
                // Shift+Arrow — extend bulk selection
                extendBulkSelection(nextItem);
            } else {
                // Plain arrow — exit bulk mode and move single selection
                listItemClickHandler(nextItem);
            }
            return;
        }

        if (event.key === keyCodes.DELETE || event.key === keyCodes.BACKSPACE) {
            // In bulk mode pass all selected ids; otherwise pass the single selected id

            onMediaDelete(isBulkMode ? Array.from(selectedIds) : selectedItemId);
            return;
        }

        if (event.key === 'Escape' && isBulkMode) {
            exitBulkMode();
        }
    };

    const onListItemKeyDown = (event, id) => {
        if (event.key === keyCodes.ENTER) {
            onListItemEnterPress(id);
        }
    };

    useEffect(() => {
        if (!listRef.current) return;

        const el = listRef.current;

        const computeItemsPerRow = () => {
            // Measure container width
            const containerWidth = el.clientWidth || 0;

            const firstItem = el.querySelector('li');
            const itemWidth = firstItem?.getBoundingClientRect?.().width || 184;

            if (containerWidth <= 0 || itemWidth <= 0) return;

            const next = Math.max(1, Math.floor(containerWidth / itemWidth));
            setItemsPerRow(next);
        };

        computeItemsPerRow();

        const ro = new ResizeObserver(() => computeItemsPerRow());
        ro.observe(el);

        return () => ro.disconnect();
    }, [view, list.length]);

    return (
        <ul
            ref={listRef}
            className={`${style.videoFilesList} ${style[view]}`}
            onKeyUp={handleKeyUp}
            onClick={(e) => {
                if (isBulkMode && !e.target.closest('li')) {
                    exitBulkMode();
                }
            }}
        >
            {list.map((item, i) => {
                if (item) {
                    return (
                        <li
                            key={`${item.id}_${i}`}
                            data-id={item.id}
                            className={getClassName(item)}
                            onClick={(e) => {
                                if (e.shiftKey) {
                                    extendBulkSelection(item);
                                } else {
                                    listItemClickHandler(item);
                                }
                            }}
                            onKeyDown={(e) => onListItemKeyDown(e, item.id)}
                            tabIndex={isBulkMode ? (selectedIds.has(item.id) ? 0 : -1) : item.id === selectedItemId ? 0 : -1}
                            inactive={item.disabled ? '1' : '0'}
                        >
                            {view === 'grid' && (
                                <Thumbnail
                                    isNsfw={item.isNsfw}
                                    hideNsfwContent={Boolean(stateContext?.userPreferences?.hideNsfwContent)}
                                    url={item.thumbnailURL}
                                    onError={() => onImageLoadError(item)}
                                    previewPath={item?.previewPath}
                                    mediaType={item.mediaType}
                                    showVideoPreviewOnHover={Boolean(stateContext?.userPreferences?.showVideoPreviewOnHover)}
                                />
                            )}
                            <div className={style.fileName}>{item.name}</div>
                            {item.mediaType === mediaTypes.VIDEO && <div className={style.metaData}>{formatTime(item.duration)}</div>}
                        </li>
                    );
                }
            })}
        </ul>
    );
};

export default VideoFilesList;
