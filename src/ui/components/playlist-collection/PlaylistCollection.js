import React, { useEffect, useState } from 'react';

import UserPlaylist from './UserPlaylist';
import PlaylistCollectionList from '__components/collections/PlaylistCollectionList';

const smartPlaylist = [
    {
        id: 'newlyAdded',
        label: 'Newly Added',
    },
    {
        id: 'topRated',
        label: 'Top Rated',
    },
    {
        id: 'mostPlayed',
        label: 'Most Played',
    },
    {
        id: 'recentlyPlayed',
        label: 'Recently Played',
    },
    {
        id: 'leastPlayed',
        label: 'Least Played',
    },
    {
        id: 'mostSearched',
        label: 'Most Searched',
    },
];

/**
 * smart playlist will be hardcoded as its not getting changed.
 * other two playlists are variable, so need to be coming from app context as of now.
 * @param onPlaylistCollectionSelect
 * @returns {JSX.Element}
 * @constructor
 */
const PlaylistCollection = ({ onPlaylistCollectionSelect = null, selectedPlaylistId = 'newlyAdded' }) => {
    const [topTagsList, setTopTagsList] = useState([]);

    const [selectedItemId, setSelectedItemId] = useState(selectedPlaylistId);
    const [smartPlaylistsList, setSmartPlaylistsList] = useState(smartPlaylist);

    const onCollectionItemClick = (item, collectionsName) => {
        setSelectedItemId(item.id);
        onPlaylistCollectionSelect(item, collectionsName);
    };

    useEffect(() => {
        window.api.getMostUsedTagsList().then((tagsArr) => {
            setTopTagsList(tagsArr);
        });

        window.api.getEchoesSmartList().then((response) => {
            if (response?.data?.mediaList.length > 0) {
                setSmartPlaylistsList([
                    ...smartPlaylist,
                    {
                        id: 'echoes',
                        label: `Echoes of ${response.data.period}`,
                    },
                ]);
            }
        });
    }, []);

    useEffect(() => {
        if (selectedItemId != selectedPlaylistId) {
            setSelectedItemId(selectedPlaylistId);
        }
    }, [selectedPlaylistId]);

    return (
        <>
            <PlaylistCollectionList
                collection={smartPlaylistsList}
                collectionType="play"
                collectionsName={'smartPlaylist'}
                collectionHeader={'Smart Playlists'}
                onCollectionItemClick={onCollectionItemClick}
                selectedItemId={selectedItemId}
            />
            <UserPlaylist selectedItemId={selectedItemId} onCollectionItemClick={onCollectionItemClick}></UserPlaylist>
            {topTagsList.length > 0 && (
                <PlaylistCollectionList
                    collection={topTagsList}
                    collectionType="play"
                    collectionsName={'tagsPlaylist'}
                    collectionHeader={'Most used Tags'}
                    onCollectionItemClick={onCollectionItemClick}
                    selectedItemId={selectedItemId}
                />
            )}
        </>
    );
};

export default PlaylistCollection;
