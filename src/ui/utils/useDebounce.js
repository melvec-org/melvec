// debounce hook function for react components

import { useEffect, useState } from 'react';

// useDebounce function should take a value ( not a function !important) and a delay as parameters
// it should return a debounced value that gets updated after the delay
const useDebounce = (value, delay) => {
    // rewrite this once again
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

export default useDebounce;
