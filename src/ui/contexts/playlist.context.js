import React, { createContext, useContext } from 'react';

const PlaylistContext = createContext();
/*
{
    currentIndex: 0,

}
*/

export const PlaylistProvider = ({ children, initialState }) => {
    return <PlaylistContext.Provider value={initialState}>{children}</PlaylistContext.Provider>;
};

export const usePlaylistContext = () => [useContext(PlaylistContext)];
