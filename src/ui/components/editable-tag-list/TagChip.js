import React, { useState } from 'react';
import style from './TagChip.css';
import IconButton from '../core-components/icon-button/IconButton';

const getClassNames = (isHighlighted, isInactive) => {
    let classNames = `${style.content}`;
    if (isHighlighted) classNames = classNames + ` ${style.hightlighted}`;
    if (isInactive) classNames = classNames + ` ${style.inactive}`;
    return classNames;
};

const TagChip = ({
    label = 'some label',
    id = '',
    editable = false,
    onTagRemove = null,
    type = '',
    isHighlighted = false,
    onSelection = null,
    isSelectable = false,
}) => {
    const [isActive, setIsActive] = useState(false);

    const classesWithState = !isActive ? `${style.tagChip}` : `${style.tagChip} ${style.active}`;
    const contentClassNames = getClassNames(isHighlighted, !isSelectable);

    const tabIndex = isSelectable || editable ? 0 : -1;

    const onTagClick = () => {
        if (isSelectable && onSelection) {
            onSelection(id);
        }
    };

    const onKeyDownOnChip = (event) => {
        if (event.key === 'Enter') {
            if (isSelectable) {
                onTagClick();
            } else if (editable) {
                setIsActive(!isActive);
            }
        }
    };

    const closeButtonKeyDown = (event) => {
        if (event.key === 'Enter') {
            onTagRemove({ id: id, label: label });
        }
    };

    return (
        <span className={classesWithState} onClick={onTagClick} onKeyDown={(e) => onKeyDownOnChip(e)} tabIndex={tabIndex}>
            <span className={contentClassNames}>
                {type === 'history' && <span className={style.typeIcon}>&#8635;</span>}
                {editable && <span onClick={() => setIsActive(!isActive)}>{label}</span>}
                {!editable && <span>{label}</span>}
                {isActive && (
                    <IconButton
                        icon={'close'}
                        _classes={style.chipCloseBtn}
                        onKeyDown={(e) => closeButtonKeyDown(e)}
                        onClick={() => {
                            onTagRemove({ id: id, label: label });
                        }}
                    />
                )}
            </span>
        </span>
    );
};

export default TagChip;
