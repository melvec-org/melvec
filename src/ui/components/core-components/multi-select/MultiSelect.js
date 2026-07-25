/**
 * multiselect react component that takes a list of options and allows the user to select multiple options
 * It should have a handler function that gets called when the user selects or deselects an option
 * It should also have a search bar that quickly filters the options based on the user's input by fist-letter matching
 * No need of debounce in search input
 * It should also take a default selected options prop
 * It should also take a override parent class prop to override the default styles
 */

import React, { useEffect, useRef, useState } from 'react';
import style from './MultiSelect.css';
import formStyles from '__styles/forms.css';

const MultiSelect = ({ options = [], onChange = () => {}, defaultSelectedOptions = [], overrideClassName = '' }) => {
    const [selectedOptions, setSelectedOptions] = useState(defaultSelectedOptions);
    const [searchInput, setSearchInput] = useState('');
    const [filteredOptions, setFilteredOptions] = useState(options);
    const searchInputRef = useRef(null);

    const handleSelectChange = (optionId) => {
        let updatedSelection;
        const isSelected = selectedOptions.includes(optionId);
        if (isSelected) {
            updatedSelection = selectedOptions.filter((selectedId) => selectedId !== optionId);
        } else {
            updatedSelection = [...selectedOptions, optionId];
        }
        setSelectedOptions(updatedSelection);
        onChange(updatedSelection);
        setSearchInput('');
        setFilteredOptions(options);
    };

    const handleSearchChange = (event) => {
        const inputValue = event.target.value.toLowerCase();
        // sort the results by matching index
        const filtered = options
            .filter((option) => option.label.toLowerCase().includes(inputValue))
            .sort((a, b) => a.label.toLowerCase(inputValue) - b.label.toLowerCase(inputValue));

        setSearchInput(event.target.value);
        setFilteredOptions(filtered);
    };

    useEffect(() => {
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 10);
    }, []);

    return (
        <div className={`${style.multiSelectContainer} ${overrideClassName}`}>
            <input
                type="text"
                className={`${formStyles.formTextInput} ${style.multiSelectSearch}`}
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="Search..."
                ref={searchInputRef}
            />
            <ul className={style.multiSelectList}>
                {filteredOptions.map((option) => (
                    <li key={option.id} onClick={() => handleSelectChange(option.id)}>
                        <input
                            type="checkbox"
                            className={formStyles.formInputCheckbox}
                            checked={selectedOptions.includes(option.id)}
                            readOnly
                        />
                        {option.label}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default MultiSelect;
