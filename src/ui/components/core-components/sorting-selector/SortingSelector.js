import React, { useState } from 'react';

const SortingSelector = ({ options, onChange, placeholder, disabled = false }) => {
    const [selectedOption, setSelectedOption] = useState(null);

    const handleSelectChange = (event) => {
        const selectedValue = event.target.value;
        setSelectedOption(selectedValue);
        onChange(selectedValue);
    };

    return (
        <select value={selectedOption || ''} onChange={handleSelectChange} disabled={disabled}>
            <option value="" disabled>
                {placeholder}
            </option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};

export default SortingSelector;
