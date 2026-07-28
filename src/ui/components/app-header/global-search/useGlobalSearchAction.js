import { useApplicationContext } from '__contexts/app.context';
import { useEffect, useState } from 'react';
import rendererEvents from '__events/rendererEvents';
import applicationEvents from '__events/applicationEvents';
import getUniqueID from '../../../../services/service-utils/getUniqueID';
import mainThreadEvents from '__events/mainThreadEvents';
import ipcChannels from '__constants/ipcChannels';
import mediaTypes from '__constants/mediaTypes';
import responseStatus from '__constants/responseStatus';

const getDefaultSearchSuggestion = (searchKeywordsHistory = [], searchedVideosHistory = []) => {
    let suggestedKeywords = [];
    if (searchKeywordsHistory && searchKeywordsHistory.length > 0) {
        suggestedKeywords = searchKeywordsHistory.map((item, index) => {
            return { label: item.label, type: 'searchedKeysHistory', id: `${index}_${item.label}` };
        });
    }

    let searchedVideosHistoryData = [];
    if (searchedVideosHistory && searchedVideosHistory.length > 0) {
        searchedVideosHistoryData = searchedVideosHistory
            .filter((item) => item !== null)
            .map((item, index) => {
                item.type = 'searchedVideosHistory';
                return item;
            });
    }

    return {
        totalSuggestions: suggestedKeywords.length + searchedVideosHistoryData.length,
        totalKeywords: suggestedKeywords.length,
        totalResults: 0,
        suggestedKeywords: suggestedKeywords,
        matchingMedia: [],
        searchedVideosHistory: searchedVideosHistoryData,
        suggestedResults: {
            files: [],
            playlists: [],
            collections: [],
        },
    };
};

const getQuickSuggestionsFocusKeys = (suggestions, addAllResultsButton = false) => {
    const focusKeys = [['filenames', 'playlists', 'collections']];
    if (suggestions?.totalResults > 0 || suggestions?.totalKeywords > 0) {
        if (suggestions.suggestedKeywords.length > 0) {
            suggestions.suggestedKeywords.forEach((item) => {
                if (item.type === 'searchedKeysHistory') {
                    focusKeys.push([item.id, `${item.id}_del`]);
                } else {
                    focusKeys.push([item.id]);
                }
            });
        }

        if (suggestions.searchedVideosHistory.length > 0) {
            suggestions.searchedVideosHistory.forEach((item) => {
                focusKeys.push([item.id]);
            });
        }
        if (suggestions.suggestedResults.playlists.length > 0) {
            suggestions.suggestedResults.playlists.forEach((item) => focusKeys.push([item.id]));
        }
        if (suggestions.suggestedResults.collections.length > 0) {
            suggestions.suggestedResults.collections.forEach((item) => focusKeys.push([item.id]));
        }
        if (suggestions.matchingMedia) {
            if (suggestions.matchingMedia.length > 0) {
                suggestions.matchingMedia.forEach((item) => focusKeys.push([item.id]));
            }
        }
    }
    if (addAllResultsButton) {
        focusKeys.push(['addAllResultsKey']);
    }

    return focusKeys;
};

const getQuickSearchSuggestions = (searchString, tags, playlists, collections, searchHistory) => {
    const key = searchString.toLowerCase();
    const MAX_SUGESTION_PER_CATEGORY = 3;

    let matchingTags = tags.filter((item) => item.label.toLowerCase().includes(key));
    let matchingPlaylists = playlists.filter((item) => item.label.toLowerCase().includes(key));
    let matchingCollections = collections.filter((item) => item.label.toLowerCase().includes(key));
    let matchingSearchHistory = searchHistory?.searchedKeys.filter((item) => item.label.toLowerCase().includes(key));

    // sorting of relevancy is pending

    matchingTags = matchingTags.sort((a, b) => a.label.indexOf(key) - b.label.indexOf(key));
    matchingPlaylists = matchingPlaylists.sort((a, b) => a.label.indexOf(key) - b.label.indexOf(key));
    matchingCollections = matchingCollections.sort((a, b) => a.label.indexOf(key) - b.label.indexOf(key));

    matchingTags = matchingTags.slice(0, MAX_SUGESTION_PER_CATEGORY).map((item) => {
        return { ...item, type: 'tag' };
    });
    matchingPlaylists = matchingPlaylists.slice(0, MAX_SUGESTION_PER_CATEGORY).map((item) => {
        return { ...item, type: 'playlist' };
    });
    matchingCollections = matchingCollections.slice(0, MAX_SUGESTION_PER_CATEGORY).map((item) => {
        return { ...item, type: 'collection' };
    });
    matchingSearchHistory = matchingSearchHistory.slice(0, MAX_SUGESTION_PER_CATEGORY).map((item) => {
        return { label: item.label, type: 'searchedKeysHistory', id: item.id };
    });

    // remove all duplicates from all suggestions
    const allSuggestion = [...matchingSearchHistory, ...matchingTags];

    // find out unique suggestion from allsuggestion array based on labels
    const uniqueSuggestions = [...new Set(allSuggestion.map((item) => item.label))];
    const uniqueSuggestionsArr = uniqueSuggestions.map((label) => {
        const item = allSuggestion.find((item) => item.label === label);
        return item;
    });

    const suggestedResults = {
        playlists: matchingPlaylists,
        collections: matchingCollections,
    };

    // combine all suggestions and sort them in descending order of relevance
    return {
        totalKeywords: uniqueSuggestionsArr.length,
        totalResults: matchingPlaylists.length + matchingCollections.length,
        suggestedKeywords: uniqueSuggestionsArr,
        suggestedResults: suggestedResults,
        searchedVideosHistory: [],
    };
};

const getSearchSuggestionByPlaylist = (searchString, playlists) => {
    const key = searchString.toLowerCase();
    const MAX_SUGESTION_PER_CATEGORY = 5;

    let matchingPlaylists = playlists.filter((item) => item.label.toLowerCase().includes(key));
    matchingPlaylists = matchingPlaylists.sort((a, b) => a.label.indexOf(key) - b.label.indexOf(key));
    matchingPlaylists = matchingPlaylists.slice(0, MAX_SUGESTION_PER_CATEGORY).map((item) => {
        return { ...item, type: 'playlist' };
    });

    return {
        totalKeywords: 0,
        totalResults: matchingPlaylists.length,
        suggestedKeywords: [],
        suggestedResults: {
            playlists: matchingPlaylists,
            collections: [],
        },
    };
};

const getSearchSuggestionByCollection = (searchString, collections, hideHiddenCollections) => {
    const key = searchString.toLowerCase();
    const MAX_SUGESTION_PER_CATEGORY = 5;
    let matchingCollections = collections.filter((item) => item.label.toLowerCase().includes(key));
    matchingCollections = matchingCollections.sort((a, b) => a.label.indexOf(key) - b.label.indexOf(key));
    matchingCollections = matchingCollections.slice(0, MAX_SUGESTION_PER_CATEGORY).map((item) => {
        return { ...item, type: 'collection' };
    });

    if (hideHiddenCollections) {
        matchingCollections = matchingCollections.filter((item) => !item.isHidden);
    }

    return {
        totalKeywords: 0,
        totalResults: matchingCollections.length,
        suggestedKeywords: [],
        searchedVideosHistory: [],
        suggestedResults: {
            playlists: [],
            collections: matchingCollections,
        },
    };
};

const getSearchSuggestionByFileNames = () => {
    return {
        totalKeywords: 0,
        totalResults: 0,
        suggestedKeywords: [],
        suggestedResults: {
            playlists: [],
            collections: [],
        },
    };
};

const filterDuplicateResults = (videoArray) => {
    const uniqueVideoIds = new Set();
    const filteredVideos = [];

    videoArray.forEach((video) => {
        if (!uniqueVideoIds.has(video.id)) {
            uniqueVideoIds.add(video.id);
            filteredVideos.push(video);
        }
    });

    return filteredVideos;
};

const enrichSearchSuggestions = (quickSuggestions, searchResults, hideHiddenCollections) => {
    quickSuggestions.matchingMedia = [];

    if (searchResults.byTags.length > 0) {
        const matchingFiles = searchResults.byTags.map((item) => ({ ...item, type: 'matchingTag' }));
        quickSuggestions.matchingMedia = [...quickSuggestions.matchingMedia, ...matchingFiles];
    }
    if (searchResults.byFileNames.length > 0) {
        const matchingFiles = searchResults.byFileNames.map((item) => ({
            ...item,
            type: 'matchingFilename',
        }));
        quickSuggestions.matchingMedia = [...quickSuggestions.matchingMedia, ...matchingFiles];
    }
    if (searchResults.byTitles.length > 0) {
        const matchingFiles = searchResults.byTitles.map((item) => ({
            ...item,
            type: 'matchingTitle',
        }));
        quickSuggestions.matchingMedia = [...quickSuggestions.matchingMedia, ...matchingFiles];
    }

    if (searchResults.byMetaData.length > 0) {
        const matchingFiles = searchResults.byMetaData.map((item) => ({
            ...item,
            type: 'matchingMetaData',
        }));
        quickSuggestions.matchingMedia = [...quickSuggestions.matchingMedia, ...matchingFiles];
    }

    // filter duplicate matching videos
    quickSuggestions.matchingMedia = filterDuplicateResults(quickSuggestions.matchingMedia);

    // sort the videos based on relevance
    quickSuggestions.matchingMedia = quickSuggestions.matchingMedia.sort((a, b) => {
        const aIndex = searchResults.byTitles.findIndex((title) => title.id === a.id);
        const bIndex = searchResults.byTitles.findIndex((title) => title.id === b.id);

        return aIndex - bIndex;
    });

    if (hideHiddenCollections) {
        quickSuggestions.matchingMedia = quickSuggestions.matchingMedia.filter((item) => !item.isHidden);
    }
    quickSuggestions.totalResults = quickSuggestions.totalResults + quickSuggestions.matchingMedia.length;
    return quickSuggestions;
};

const defaultFocusPointer = { row: null, col: null, target: null };

const useGlobalSearchAction = () => {
    const [applicationContext, dispatchContext] = useApplicationContext();
    const [searchHistory, setSearchHistory] = useState(null);
    const [indexedSearchHistory, setIndexedSearchHistory] = useState([]);
    const [isAiSearchEnabled, setIsAiSearchEnabled] = useState([false]);

    // search suggestion is formed locally - not hitting any service
    const [searchSuggestions, setSearchSuggestions] = useState([]);

    // search results are fetched from service - it's an asynchronous operation
    const [fullSearchResults, setFullSearchResults] = useState(null);

    const [searchFilter, setSearchFilter] = useState('');
    const [correctedSearchText, setCorrectedSearchText] = useState('');

    const [currentFocusPointer, setCurrentFocusPointer] = useState(defaultFocusPointer);

    useEffect(() => {
        window.api.getSearchHistory().then((data) => {
            setSearchHistory(data);

            setInitialSearchSuggestion(data);
        });

        window.api.getIndexedSearchHistory().then((history) => {
            setIndexedSearchHistory(history);
        });
    }, []);

    const resetFocusPointer = () => {
        setCurrentFocusPointer(defaultFocusPointer);
    };

    const setInitialSearchSuggestion = (searchHistory) => {
        let defaultSearchSuggestion = getDefaultSearchSuggestion(searchHistory.searchedKeys, searchHistory.searchedVideos);

        defaultSearchSuggestion['focusKeys'] = getQuickSuggestionsFocusKeys(defaultSearchSuggestion);
        setSearchSuggestions(defaultSearchSuggestion);
    };

    /**
     * QuickSearch will search few history items, matching playlist, tags, collection names
     * @param {*} searchText
     */
    const quickSearch = (searchText) => {
        resetFocusPointer(defaultFocusPointer);

        // this is when user focuses on the search box without typing anything
        if (searchText === '') {
            if (searchFilter === '' && searchHistory?.searchedKeys.length > 0) {
                setInitialSearchSuggestion(searchHistory);
            } else if (searchFilter !== '') {
                setInitialSearchSuggestion([]);
            } else {
                setSearchSuggestions({
                    focusKeys: getQuickSuggestionsFocusKeys(),
                });
            }
        } else {
            if (searchFilter === '') {
                // find searchSuggestions
                let quickSuggestions = getQuickSearchSuggestions(
                    searchText,
                    applicationContext.tags,
                    applicationContext.playlists,
                    applicationContext.collections,
                    searchHistory,
                );
                // check for tags, titles, filenames form search service
                // note this would return video files
                if (searchText.length >= 2) {
                    window.api.getSearchResults(searchText, true).then((results) => {
                        if (results) {
                            quickSuggestions = enrichSearchSuggestions(quickSuggestions, results, applicationContext.hideHiddenCollections);
                            quickSuggestions['focusKeys'] = getQuickSuggestionsFocusKeys(quickSuggestions, true);
                            setSearchSuggestions(quickSuggestions);

                            setCorrectedSearchText(results.correctedText);
                        }
                    });
                } else {
                    quickSuggestions['focusKeys'] = getQuickSuggestionsFocusKeys(quickSuggestions);
                    setSearchSuggestions(quickSuggestions);
                }
            } else {
                if (searchFilter === 'playlists') {
                    let quickSuggestions = getSearchSuggestionByPlaylist(searchText, applicationContext.playlists);
                    quickSuggestions['focusKeys'] = getQuickSuggestionsFocusKeys(quickSuggestions);
                    setSearchSuggestions(quickSuggestions);
                }
                if (searchFilter === 'collections') {
                    let quickSuggestions = getSearchSuggestionByCollection(
                        searchText,
                        applicationContext.collections,
                        applicationContext.hideHiddenCollections,
                    );

                    quickSuggestions['focusKeys'] = getQuickSuggestionsFocusKeys(quickSuggestions);
                    setSearchSuggestions(quickSuggestions);
                }
                if (searchFilter === 'filenames') {
                    let quickSuggestions = getSearchSuggestionByFileNames();
                    if (searchText.length >= 2) {
                        window.api.getSearchResults(searchText, true, { fileNames: true }).then((results) => {
                            if (results) {
                                quickSuggestions = enrichSearchSuggestions(
                                    quickSuggestions,
                                    results,
                                    applicationContext.hideHiddenCollections,
                                );

                                quickSuggestions['focusKeys'] = getQuickSuggestionsFocusKeys(quickSuggestions, true);
                                setSearchSuggestions(quickSuggestions);
                            }
                        });
                    }
                }
            }
        }
    };

    const cacheHistoryItems = () => {
        window.api.getIndexedSearchHistory().then((history) => {
            setSearchHistory(history);
        });
        window.api.getSearchHistory().then((history) => {
            setSearchHistory(history);
        });
    };

    const checkForHiddenCollection = (fullSearchResults) => {
        if (applicationContext.hideHiddenCollections) {
            if (fullSearchResults.byFileNames.length > 0) {
                fullSearchResults.byFileNames = fullSearchResults.byFileNames.filter((item) => !item.isHidden);
            }
            if (fullSearchResults.byTitles.length > 0) {
                fullSearchResults.byTitles = fullSearchResults.byTitles.filter((item) => !item.isHidden);
            }
            if (fullSearchResults.byTags.length > 0) {
                fullSearchResults.byTags = fullSearchResults.byTags.filter((item) => !item.isHidden);
            }
            fullSearchResults.totalCount =
                fullSearchResults.byFileNames.length + fullSearchResults.byTitles.length + fullSearchResults.byTags.length;

            return fullSearchResults;
        } else {
            return fullSearchResults;
        }
    };

    const fullSearch = (searchText) => {
        if (searchText !== '') {
            resetFocusPointer(defaultFocusPointer);

            window.api.getSearchResults(searchText, false).then((results) => {
                if (results) {
                    window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                        event: rendererEvents.SEARCH_HISTORY_ADD,
                        searchText: searchText,
                    });
                    cacheHistoryItems();

                    setFullSearchResults(checkForHiddenCollection(results));
                }
            });
        }
    };

    const onSeachResultsItemClick = (item, searchText) => {
        window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
            event: rendererEvents.SEARCH_HISTORY_ADD,
            selectedItem: item,
        });

        cacheHistoryItems();
        if (item.mediaType === mediaTypes.VIDEO) {
            window.api.getFullVideoDetails(item.id).then((data) => {
                if (data) {
                    const collectionToJump = applicationContext.collections.find((item) => item.id === data.collectionId);
                    dispatchContext({
                        type: applicationEvents.GOTO_COLLECTION,
                        payload: {
                            selectedCollection: collectionToJump,
                            selectedVideoId: data.id,
                        },
                    });
                }
            });
        } else if (item.mediaType === mediaTypes.IMAGE) {
            window.api.getFullImageDetails(item.id).then((response) => {
                if (response.status === responseStatus.SUCCESS && response.data) {
                    const collectionToJump = applicationContext.collections.find((item) => item.id === response.data.collectionId);
                    dispatchContext({
                        type: applicationEvents.GOTO_COLLECTION,
                        payload: {
                            selectedCollection: collectionToJump,
                            selectedVideoId: response.data.id,
                        },
                    });
                }
            });
        } else if (item.mediaType === mediaTypes.AUDIO) {
            window.api.getFullAudioDetails(item.id).then((response) => {
                if (response.status === responseStatus.SUCCESS && response.data) {
                    const collectionToJump = applicationContext.collections.find((item) => item.id === response.data.collectionId);
                    dispatchContext({
                        type: applicationEvents.GOTO_COLLECTION,
                        payload: {
                            selectedCollection: collectionToJump,
                            selectedVideoId: response.data.id,
                        },
                    });
                }
            });
        }
    };

    const onQuickSearchResultItemClick = (resultType, resultItem, searchText) => {
        if (resultItem.type !== 'searchedVideosHistory') {
            window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                event: rendererEvents.SEARCH_HISTORY_ADD,
                searchText: searchText,
            });
        }

        if (resultType === 'collection') {
            const collectionToJump = applicationContext.collections.find((item) => item.label === resultItem.label);
            dispatchContext({
                type: applicationEvents.GOTO_COLLECTION,
                payload: {
                    selectedCollection: collectionToJump,
                    selectedVideoId: null,
                },
            });
        }
        if (resultType === 'playlist') {
            const playlistToJump = applicationContext.playlists.find((item) => item.label === resultItem.label);
            dispatchContext({
                type: applicationEvents.GOTO_PLAYLIST,
                payload: {
                    playlist: playlistToJump,
                },
            });
        }
        if (resultType === 'file') {
            onSeachResultsItemClick(resultItem, searchText);
        }

        if (resultType === 'searchedVideosHistory') {
            const collectionToJump = applicationContext.collections.find((item) => item.label === resultItem.collection);

            dispatchContext({
                type: applicationEvents.GOTO_COLLECTION,
                payload: {
                    selectedCollection: collectionToJump,
                    selectedVideoId: resultItem.id,
                },
            });
        }
    };

    const createAndViewInPlaylist = (videoList, searchText) => {
        const newPlaylist = {
            label: `Search - ${searchText.trim()}`,
            id: getUniqueID(),
        };

        // check for duplicate playlist
        const isDuplicatePlaylist = applicationContext.playlists.find((item) => item.label === newPlaylist.label);
        if (isDuplicatePlaylist) {
            dispatchContext({
                type: applicationEvents.PLAY_VIDEO_FROM_PLAYLIST,
                payload: {
                    currentPlaylist: videoList,
                    currentPlayItem: videoList[0],
                    currentPlaylistName: newPlaylist.label,
                },
            });
        } else {
            window.api.addNewPlaylist(newPlaylist).then((response) => {
                if (response?.status == responseStatus.SUCCESS) {
                    dispatchContext({ type: mainThreadEvents.ON_PLAYLIST_UPDATE, payload: { playlists: response.data } });
                    window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                        event: rendererEvents.ADD_MULTIPLE_VIDEOS_TO_PLAYLIST,
                        playlist: newPlaylist,
                        videoIds: videoList.map((item) => item.id),
                    });

                    dispatchContext({
                        type: applicationEvents.PLAY_VIDEO_FROM_PLAYLIST,
                        payload: {
                            currentPlaylist: videoList,
                            currentPlayItem: videoList[0],
                            currentPlaylistName: `Search - ${searchText}`,
                        },
                    });
                } else {
                    alert('Failed to add playlist', response.message);
                }
            });
        }
    };

    const deleteSearchHistoryItem = (historyItem) => {
        searchSuggestions.suggestedKeywords = searchSuggestions.suggestedKeywords.filter((item) => item.id != historyItem.id);
        searchSuggestions.totalKeywords = searchSuggestions.suggestedKeywords.length;

        searchSuggestions['focusKeys'] = getQuickSuggestionsFocusKeys(searchSuggestions);

        resetFocusPointer(defaultFocusPointer);

        setSearchSuggestions(searchSuggestions);

        window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
            event: rendererEvents.SEARCH_HISTORY_DELETE,
            searchText: historyItem.label,
        });

        window.api.getIndexedSearchHistory().then((history) => {
            setSearchHistory(history);
        });

        window.api.getSearchHistory().then((history) => {
            setSearchHistory(history);
        });
    };

    return {
        fullSearchResults,
        searchSuggestions,
        quickSearch,
        fullSearch,
        onSeachResultsItemClick,
        createAndViewInPlaylist,
        setSearchFilter,
        deleteSearchHistoryItem,
        onQuickSearchResultItemClick,
        currentFocusPointer,
        setCurrentFocusPointer,
        correctedSearchText,
    };
};
export default useGlobalSearchAction;
