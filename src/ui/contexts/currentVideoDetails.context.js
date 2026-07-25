import React, { createContext, useState, useContext } from 'react';

const CurrentVideoDetailsContext = createContext();

export const CurrentVideoDetailsProvider = ({ children }) => {
    const [currentVideoDetails, setCurrentVideoDetails] = useState(null);

    return (
        <CurrentVideoDetailsContext.Provider value={{ currentVideoDetails, setCurrentVideoDetails }}>
            {children}
        </CurrentVideoDetailsContext.Provider>
    );
};

export const useCurrentVideoDetailsContext = () => {
    return useContext(CurrentVideoDetailsContext);
};
