import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/layouts/Sidebar';
import PlaylistCollection from '../../components/playlist-collection/PlaylistCollection';
import MainPanel from '../../components/layouts/MainPanel';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import RecentlyAddedVideos from './newly-added-videos/newlyAddedVideos';
import LeastPlayedVideos from './least-played-videos/LeastPlayedVideos';
import MostPlayedVideos from './most-played-videos/MostPlayedVideos';
import RecommendedVideos from './top-rated-videos/TopRatedVideos';
import RecentlyPlayedVideos from './recently-played-videos/RecentlyPlayedVideos';
import EchoesVideos from './echoes-videos/EchoesVideos';
import UserPlaylistVideos from './user-playlist-videos/UserPlaylistVideos';
import TopTagsPlaylistVideos from './top-tags-playlist-videos/TopTagsPlaylistVideos';
import MostSearchedVideos from './most-searched-videos/MostSearchedVideo';
import { useApplicationContext } from '__contexts/app.context';
import ResizableSidePanel from '__components/resizable-panel/ResizableSidePanel';

const playlistMap = {
    newlyAdded: <RecentlyAddedVideos />,
    mostPlayed: <MostPlayedVideos />,
    recentlyPlayed: <RecentlyPlayedVideos />,
    topRated: <RecommendedVideos />,
    leastPlayed: <LeastPlayedVideos />,
    mostSearched: <MostSearchedVideos />,
    echoes: <EchoesVideos />,
};

const getPlaylistDetailsComponent = ({ playlist, type }) => {
    if (type === 'smartPlaylist') return playlistMap[playlist.id];
    else if (type === 'userPlaylist')
        return <UserPlaylistVideos playlistId={playlist.id} playlistLabel={playlist.label} />;
    else if (type === 'tagsPlaylist') return <TopTagsPlaylistVideos tagId={playlist.id} tagLabel={playlist.label} />;
};

const defaultPlaylist = {
    playlist: {
        label: 'Newly added',
        id: 'newlyAdded',
    },
    type: 'smartPlaylist',
};

const Dashboard = () => {
    const [selectedPlaylist, setSelectedPlaylist] = useState(defaultPlaylist);
    const [appContext] = useApplicationContext();

    const onPlaylistCollectionSelect = (item, playlistCollectionsName) => {
        switch (playlistCollectionsName) {
            case 'smartPlaylist':
                setSelectedPlaylist({ playlist: item, type: 'smartPlaylist' });
                window.api.setApplicationSettings('currentSelectedPlaylist', { playlist: item, type: 'smartPlaylist' });
                break;
            case 'userPlaylist':
                setSelectedPlaylist({ playlist: item, type: 'userPlaylist' });
                window.api.setApplicationSettings('currentSelectedPlaylist', { playlist: item, type: 'userPlaylist' });
                break;
            case 'tagsPlaylist':
                setSelectedPlaylist({ playlist: item, type: 'tagsPlaylist' });
                window.api.setApplicationSettings('currentSelectedPlaylist', { playlist: item, type: 'tagsPlaylist' });
                break;
        }
    };

    useEffect(() => {
        if (appContext?.currentDashboardState?.selectedPlaylist) {
            setSelectedPlaylist({
                playlist: appContext.currentDashboardState.selectedPlaylist,
                type: 'userPlaylist',
            });
        }
        return () => {
            setSelectedPlaylist(selectedPlaylist);
        };
    }, [appContext?.currentDashboardState?.selectedPlaylist]);

    useEffect(() => {
        window.api.getApplicationSettings('currentSelectedPlaylist').then((data) => {
            if (data) {
                // check if the data contains playlist that is available.
                if (data.type === 'userPlaylist') {
                    if (appContext.playlists.find((playlist) => playlist.id === data.playlist.id)) {
                        setSelectedPlaylist(data);
                    } else {
                        // If the playlist is not available, reset to default.
                        setSelectedPlaylist(defaultPlaylist);
                    }
                } else {
                    setSelectedPlaylist(data);
                }
            }
        });
    }, []);

    return (
        <DashboardLayout>
            <ResizableSidePanel
                maxWidth={400}
                minWidth={250}
                initialWidth={240}
                direction="right"
                panelId="playlistsSidebar"
            >
                <Sidebar headerLabel={'Playlists'}>
                    <PlaylistCollection
                        onPlaylistCollectionSelect={onPlaylistCollectionSelect}
                        selectedPlaylistId={selectedPlaylist.playlist.id}
                    />
                </Sidebar>
            </ResizableSidePanel>

            <MainPanel>{getPlaylistDetailsComponent(selectedPlaylist)}</MainPanel>
        </DashboardLayout>
    );
};
export default Dashboard;
