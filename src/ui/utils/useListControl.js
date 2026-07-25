/**
 * This file is to be used as list navigation control which will show case
 * selected item, high light for accessibility
 * and should be able to navigate via keyboard arrow and tabs
 */

import React, { useState } from 'react';
import keyCodes from '__constants/keyCodes';

/**
 * this cycles forward in a list
 * @param {} list
 * @param {*} selectedItem
 * @returns
 */
export const getNextSelectedionId = (list, selectedItem) => {
    const currentIndex = list.findIndex((item) => item.id === selectedItem.id);

    if (currentIndex === list.length - 1) {
        return list[0];
    } else {
        return list[currentIndex + 1];
    }
};

/**
 * this cycles backward in a list
 * @param {} list
 * @param {*} selectedItem
 */
export const getPreviousSelectionId = (list, selectedItem) => {
    const currentIndex = list.findIndex((item) => item.id === selectedItem.id);

    if (currentIndex === 0) {
        return list[list.length - 1];
    } else {
        return list[currentIndex - 1];
    }
};

/**
 * This custom hook is to control list navigation
 * @param {Array} list
 * @param {Object} selectedItem
 * */
const useListControl = (defaultFocusedListItem = null) => {
    const [focusedListItem, setFocusedListItem] = useState(defaultFocusedListItem);
    const [selectionByEnter, setSelectionByEnter] = useState(null);
    const [list, setList] = useState([]);

    const handleKeyUp = (event) => {
        if (event.key === keyCodes.ENTER) {
            setSelectionByEnter(focusedListItem);
        }
        if (event.key === keyCodes.TAB) {
            event.preventDefault();
        }
        if (event.key === keyCodes.ARROW_DOWN || event.key === keyCodes.ARROW_RIGHT) {
            setFocusedListItem(getNextSelectedionId(list, focusedListItem));
        }
        if (event.key === keyCodes.ARROW_UP || event.key === keyCodes.ARROW_LEFT) {
            setFocusedListItem(getPreviousSelectionId(list, focusedListItem));
        }
    };

    return { focusedListItem, handleKeyUp, setFocusedListItem, selectionByEnter, setList };
};

export default useListControl;

// Usage
