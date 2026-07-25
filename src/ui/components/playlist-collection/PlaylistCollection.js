import React, { useEffect, useState } from 'react';
import Collections from '../collections/Collections';

import UserPlaylist from './UserPlaylist';

const smartPlaylist = [
    {
        id: 'newlyAdded',
        label: 'Newly added',
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
        label: 'Recently played',
    },
    {
        id: 'leastPlayed',
        label: 'Least played',
    },
    {
        id: 'mostSearched',
        label: 'Most searched',
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

        window.api.getEchoesSmartList().then((echoes) => {
            if (echoes[0]) {
                setSmartPlaylistsList([
                    ...smartPlaylist,
                    {
                        id: 'echoes',
                        label: 'Echoes',
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
            <Collections
                collection={smartPlaylistsList}
                collectionType="play"
                collectionsName={'smartPlaylist'}
                collectionHeader={'Smart Playlists'}
                onCollectionItemClick={onCollectionItemClick}
                selectedItemId={selectedItemId}
            />
            <UserPlaylist selectedItemId={selectedItemId} onCollectionItemClick={onCollectionItemClick}></UserPlaylist>
            {topTagsList.length > 0 && (
                <Collections
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
