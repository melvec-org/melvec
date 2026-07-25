import React, { useState } from 'react';
import style from './GlobalSearch.css';
import Chip from '__components/core-components/chip/Chip';

const categoryFilters = [
    {
        label: 'File names',
        id: 'filenames',
        isSelected: false,
    },
    {
        label: 'Playlists',
        id: 'playlists',
        isSelected: false,
    },
    {
        label: 'Collections',
        id: 'collections',
        isSelected: false,
    },
];

const QuickSearchCategoryFilter = ({ onSelection = null, focusKey = null }) => {
    const [filters, setFilters] = useState(categoryFilters);
    const onCategoryFilterClick = (label) => {
        const newFilters = filters.map((item) => {
            if (item.label === label) {
                item.isSelected = !item.isSelected;
            } else {
                item.isSelected = false;
            }
            return item;
        });
        const selection = newFilters.find((item) => item.isSelected === true);

        setFilters(newFilters);
        if (selection) {
            onSelection(selection.id);
        } else {
            onSelection('');
        }
    };

    return (
        <ul className={style.suggestionsFloatingPanelSection}>
            {filters.map((item) => (
                <Chip
                    id={item.label}
                    key={item.label}
                    isSelected={item.isSelected}
                    isFocused={item.id === focusKey}
                    onSelection={onCategoryFilterClick}
                >
                    {item.label}
                </Chip>
            ))}
        </ul>
    );
};

export default QuickSearchCategoryFilter;
