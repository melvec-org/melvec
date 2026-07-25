import React, { useEffect, useState } from 'react';

const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

const InputFilter = ({ onChange }) => {
    const [inputValue, setInputValue] = useState('');
    const debouncedInputValue = useDebounce(inputValue, 200); // 200ms debounce

    useEffect(() => {
        onChange(debouncedInputValue);
    }, [debouncedInputValue]);

    return (
        <div>
            <input
                type="text"
                placeholder="Type to search"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
            />
        </div>
    );
};

export default InputFilter;
