import React, { useState } from 'react';
import IconButton from '__components/core-components/icon-button/IconButton';
import editableStyles from './EditableList.css';

const EditableListItem = ({ item, removeHandler, editHandler }) => {
    const isItemEditable = item?.editable !== true;
    const listClassName = isItemEditable
        ? `${editableStyles.editableListItem}`
        : `${editableStyles.editableListItem} ${editableStyles.disabledListItem}`;

    const onItemRemove = (item) => {
        removeHandler(item);
    };

    return (
        <li className={listClassName} tabIndex={0}>
            <span>{item.label}</span>
            {isItemEditable && (
                <div className={editableStyles.editableListActionGroup}>
                    <IconButton title="Edit" icon="edit" onClick={() => editHandler()} />
                    <IconButton title="Delete" icon="close" onClick={() => onItemRemove(item)} />
                </div>
            )}
        </li>
    );
};

const folderNameRegex = /^[^\s^\x00-\x1f\\?*:"";<>|\/.][^\x00-\x1f\\?*:"";<>|\/]*[^\s^\x00-\x1f\\?*:"";<>|\/.]+$/;

/**
 *
 * @param list
 * @param removeHandler
 * @param editHandler
 * @returns {JSX.Element}
 * @constructor
 */
const EditableList = ({ list = [], removeHandler, editHandler }) => {
    const [addInputError, showAddInputError] = useState(false);

    /**
     * Validate the input if that is a valid folder name/filename etc
     * @param val
     */
    const validateInput = (val) => {
        let hasError = false;

        const listLabels = list.map((item) => item.label);
        if (listLabels.includes(val)) {
            hasError = true;
            showAddInputError(true);
            return;
        }
        if (!folderNameRegex.test(val)) {
            hasError = true;
        }
        if (hasError) {
            showAddInputError(true);
            return;
        }
        showAddInputError(false);
    };

    return (
        <>
            <ul className={editableStyles.editableListContainer}>
                {list.map((item) => (
                    <EditableListItem
                        item={item}
                        key={item.id || item.label}
                        editHandler={() => editHandler(item)}
                        removeHandler={removeHandler}
                    />
                ))}
            </ul>
        </>
    );
};

export default EditableList;
