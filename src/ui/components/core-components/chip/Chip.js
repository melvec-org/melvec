import React from 'react';
import style from './Chip.css';

const Chip = ({
    children,
    isSelected = false,
    id,
    readOnly = false,
    onSelection = null,
    tabIndex = -1,
    isFocused = false,
}) => {
    const classNames = `${style.chip} ${isSelected ? `${style.selected}` : ''}`;
    const onChipClick = (id) => {
        if (onSelection && !readOnly) {
            onSelection(id);
        }
    };

    return (
        <span
            tabIndex={tabIndex}
            className={classNames}
            onClick={() => onChipClick(id)}
            isfocused={isFocused ? 'true' : 'false'}
        >
            {children}
        </span>
    );
};

export default Chip;
