import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import style from './GlobalSearch.css';
import Button from '../../../components/core-components/button/Button';
import useGlobalSearchAction from './useGlobalSearchAction';
import useDebounce from '../../../utils/useDebounce';
import QuickSearchCategoryFilter from './QuickSearchCategoryFilter';
import SearchResults from './SearchResults';
import Chip from '__components/core-components/chip/Chip';
import IconButton from '__components/core-components/icon-button/IconButton';
import PlaylistIcon from '__components/core-components/icons/PlaylistIcon';
import CollectionIcon from '__components/core-components/icons/CollectionIcon';
import Thumbnail from '__components/core-components/thumbnail/Thumbnail';
import applicationMenuEvents from '__events/applicationMenuEvents';
import { registerAccKeyListener, unregisterAccKeyListener } from '__utils/acceleratorKeysListenerRegistry';
import { useApplicationContext } from '__contexts/app.context';
import AiIcon from '__components/core-components/icons/aiIcon';
import mediaTypes from '__constants/mediaTypes';

const TYPE_DEBOUNCE_TIME = 500;
const DIRECTION_KEYS = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'];

const SearchHistorySuggestionItem = ({ item, onSuggestedKeywordSelect, deleteSearchItem, focusKey }) => {
    const onSearchSuggestionKeyUp = (evt, label) => {
        if (evt.key === 'Enter') {
            onSuggestedKeywordSelect(label);
        }
    };

    return (
        <li className={style.searchSuggestionListItem}>
            <span
                className={style.searchSuggestionKeyword}
                onClick={() => onSuggestedKeywordSelect(item.label)}
                onKeyUp={(evt) => onSearchSuggestionKeyUp(evt, item.label)}
                isfocused={focusKey === item.id ? 'true' : 'false'}
            >
                <span className="mr5">&#8635;</span>
                {item.label}
            </span>

            <IconButton
                icon={'close'}
                _classes={style.removeHistoryBtn}
                title="Remove"
                isfocused={`${item.id}_del` === focusKey ? 'true' : 'false'}
                onClick={() => deleteSearchItem(item)}
            ></IconButton>
        </li>
    );
};

const GlobalSearch = () => {
    const [searchText, setSearchText] = useState('');
    const {
        quickSearch,
        fullSearch,
        fullSearchResults,
        searchSuggestions,
        onSeachResultsItemClick,
        createAndViewInPlaylist,
        setSearchFilter,
        deleteSearchHistoryItem,
        onQuickSearchResultItemClick,
        currentFocusPointer,
        setCurrentFocusPointer,
        correctedSearchText,
    } = useGlobalSearchAction();

    const [stateContext] = useApplicationContext();

    const [quickSearchDropDown, setQuickSearchDropDown] = useState(false);
    const searchContentRef = useRef();
    const [showResultsPanel, setShowResultsPanel] = useState(false);

    const debouncedValue = useDebounce(searchText, TYPE_DEBOUNCE_TIME);

    const handleChange = useCallback((e) => {
        setSearchText(e.target.value);
    }, []);

    useEffect(() => {
        quickSearch(debouncedValue);
    }, [debouncedValue]);

    useEffect(() => {
        registerAccKeyListener(applicationMenuEvents.START_SEARCH, () => {
            if (document.getElementById('melvec-global-search')) {
                document.getElementById('melvec-global-search').focus();
            }
        });
        return () => {
            unregisterAccKeyListener(applicationMenuEvents.START_SEARCH);
        };
    }, []);

    const clearSearch = () => {
        setSearchText('');
    };

    const onSearchResultItemClick = (item) => {
        onSeachResultsItemClick(item, searchText);
        closeSearch();
    };

    const onQuickSearchResultClick = (resultType, resultItem) => {
        onQuickSearchResultItemClick(resultType, resultItem, searchText);
        closeSearch();
    };

    const createPlaylist = (mediaList) => {
        const videoList = mediaList.filter((item) => item.mediaType === mediaTypes.VIDEO);
        if (videoList.length > 0) {
            createAndViewInPlaylist(videoList, searchText);
            clearSearch();
            setShowResultsPanel(false);
        } else {
            alert('Can not create a list : No video present in the search results.');
        }
    };

    const getNextFocus = (key, currentFocusPointer) => {
        let row = currentFocusPointer.row;
        let col = currentFocusPointer.col;

        // ignore if left and arrow is pressed wihout navigating down.
        if ((key === 'ArrowLeft' || key === 'ArrowRight') && row === null) {
            return null;
        }

        if (key === 'ArrowDown') {
            if (row === null) {
                row = 0;
                col = 0;
            } else if (row < searchSuggestions.focusKeys.length - 1) {
                row = row + 1;
                col = 0;
            } else {
                row = 0;
                col = 0;
            }
        }
        if (key === 'ArrowUp') {
            if (row === null) {
                row = searchSuggestions.focusKeys.length - 1;
                col = 0;
            } else if (row > 0) {
                row = row - 1;
                col = 0;
            } else {
                row = searchSuggestions.focusKeys.length - 1;
                col = 0;
            }
        }

        if (key === 'ArrowLeft') {
            if (col <= 0) {
                col = searchSuggestions.focusKeys[row].length - 1;
            } else {
                col = col - 1;
            }
        }
        if (key === 'ArrowRight') {
            if (col >= searchSuggestions.focusKeys[row].length - 1) {
                col = 0;
            } else {
                col = col + 1;
            }
        }

        return { row, col, target: searchSuggestions.focusKeys[row][col] };
    };

    const navigateInSuggestionsFloatingPanel = (direction) => {
        const nextPointer = getNextFocus(direction, currentFocusPointer);
        if (nextPointer != null) {
            setCurrentFocusPointer(nextPointer);
        }
        return null;
    };

    const onSearchBoxKeyDown = (evt) => {
        if (evt.key === 'Escape') {
            if (quickSearchDropDown) {
                evt.preventDefault();
                setQuickSearchDropDown(false);
                return;
            }
            if (showResultsPanel) {
                evt.preventDefault();
                setShowResultsPanel(false);
                return;
            }
        }
        if (DIRECTION_KEYS.includes(evt.key)) {
            navigateInSuggestionsFloatingPanel(evt.key);
            return;
        }
        if (evt.key === 'Enter') {
            if (currentFocusPointer.target != null) {
                document.querySelector(`[isfocused="true"]`).click();
                return;
            } else if (evt.target.value.trim().length >= 2) {
                startFullSearch(evt.target.value.trim());
                return;
            }
        }
        if (evt.key === 'Tab' && showResultsPanel !== true) {
            closeSearch();
            document.removeEventListener('mouseup', checkForOutsideClick);
            return;
        } else if (evt.key === 'Tab' && showResultsPanel === true) {
            return;
        }
        // finally if there is some value in search input, show quick search dropdown
        if (!quickSearchDropDown && evt.target.value !== '') {
            setQuickSearchDropDown(true);
        }
    };

    const onSearchInputFocus = (evt) => {
        setQuickSearchDropDown(true);
    };

    const startFullSearch = (searchText) => {
        fullSearch(searchText);
        setShowResultsPanel(true);
        setQuickSearchDropDown(false);
    };

    const onSuggestedKeywordSelect = (suggestionKeyword) => {
        setSearchText(suggestionKeyword);
        startFullSearch(suggestionKeyword);
    };

    const onQuickSearchSuggestionKeyUp = (evt, label) => {
        if (evt.key === 'Enter') {
            onSuggestedKeywordSelect(label);
        }
    };

    const closeSearch = () => {
        setSearchText('');
        setShowResultsPanel(false);
        setQuickSearchDropDown(false);
    };

    const checkForOutsideClick = (event) => {
        if (!searchContentRef?.current?.contains(event.target)) {
            closeSearch();
            document.removeEventListener('mouseup', checkForOutsideClick);
        }
    };

    useEffect(() => {
        if (quickSearchDropDown) {
            document.addEventListener('mouseup', checkForOutsideClick);
        } else {
            document.removeEventListener('mouseup', checkForOutsideClick);
        }
    }, [quickSearchDropDown]);

    const onCategoryFilterChange = (selectedCategory) => {
        setSearchFilter(selectedCategory);
    };

    return (
        <div className={style.globalSearch} ref={searchContentRef}>
            <div className={style.searchControl}>
                <span className={style.searchIcon}>
                    <svg width="14" height="16">
                        <g strokeWidth="2" stroke="#6c6c6c" fill="none">
                            <path d="M13.4 13.71l-4-4" />
                            <circle cx="6" cy="6" r="5" />
                        </g>
                    </svg>
                </span>
                <input
                    id="melvec-global-search"
                    className={style.globalSearchInput}
                    type="search"
                    placeholder="Search all media, tags, playlists, collections (&#8984; + F)"
                    value={searchText}
                    onKeyDown={onSearchBoxKeyDown}
                    onChange={handleChange}
                    tabIndex={0}
                    onFocusCapture={(evt) => onSearchInputFocus(evt)}
                />
            </div>
            {stateContext?.userPreferences?.isAISupported === true && stateContext?.userPreferences?.isAIEnabled && (
                <span className={style.isAIEnabled} title="AI Enabled">
                    <AiIcon />
                </span>
            )}

            {quickSearchDropDown && (
                <div className={style.suggestionsFloatingPanel}>
                    <QuickSearchCategoryFilter onSelection={onCategoryFilterChange} focusKey={currentFocusPointer.target} />
                    {correctedSearchText !== '' && (
                        <div className={style.searchHints}>
                            Showing results for: <strong>{correctedSearchText}</strong>
                        </div>
                    )}

                    {searchSuggestions.totalKeywords > 0 && (
                        <div className={style.searchSuggestion}>
                            <div className={style.label}>Search suggestions</div>
                            <ul className={style.searchSuggestionList}>
                                {searchSuggestions.suggestedKeywords.map((item) => {
                                    if (item.type === 'searchedKeysHistory') {
                                        return (
                                            <SearchHistorySuggestionItem
                                                item={item}
                                                onSuggestedKeywordSelect={onSuggestedKeywordSelect}
                                                key={item.id}
                                                focusKey={currentFocusPointer.target}
                                                deleteSearchItem={deleteSearchHistoryItem}
                                            />
                                        );
                                    }
                                    if (item.type === 'tag') {
                                        return (
                                            <li
                                                className={style.searchSuggestionListItem}
                                                key={item.label + '' + item.id}
                                                onClick={() => onSuggestedKeywordSelect(item.label)}
                                                onKeyUp={(evt) => onQuickSearchSuggestionKeyUp(evt, item.label)}
                                            >
                                                <span
                                                    className={style.searchSuggestionKeyword}
                                                    isfocused={currentFocusPointer.target === item.id ? 'true' : 'false'}
                                                >
                                                    {item.label}
                                                </span>
                                            </li>
                                        );
                                    }
                                })}
                            </ul>
                            {searchSuggestions.searchedVideosHistory.length > 0 && (
                                <div className={style.label}>Recent searched videos</div>
                            )}

                            <ul className={style.searchSuggestionList}>
                                {searchSuggestions.searchedVideosHistory.map((item) => {
                                    return (
                                        <li
                                            className={style.searchSuggestionListItem}
                                            key={item.id}
                                            onClick={() => onQuickSearchResultClick('searchedVideosHistory', item)}
                                        >
                                            <span
                                                className={style.searchSuggestionVideo}
                                                isfocused={currentFocusPointer.target === item.id ? 'true' : 'false'}
                                            >
                                                <Thumbnail url={item.thumbnailURL} variant="xs" />
                                                <span className="ml10">{item.name}</span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                    {searchSuggestions.totalResults > 0 && (
                        <div className={style.searchSuggestion}>
                            {searchSuggestions.suggestedResults.playlists.length > 0 && <div className={style.label}>Playlists</div>}
                            <ul className={style.searchSuggestionList}>
                                {searchSuggestions.suggestedResults.playlists?.map((item) => {
                                    if (item.type === 'playlist') {
                                        return (
                                            <li
                                                className={style.searchSuggestionListItem}
                                                key={item.label + '' + item.id}
                                                onClick={() => onQuickSearchResultClick('playlist', item)}
                                            >
                                                <span
                                                    className={style.searchSuggestionKeyword}
                                                    isfocused={currentFocusPointer.target === item.id ? 'true' : 'false'}
                                                >
                                                    <PlaylistIcon isInline={true} />
                                                    {item.label}
                                                </span>
                                            </li>
                                        );
                                    }
                                })}
                                {searchSuggestions.suggestedResults.collections.length > 0 && <li className={style.label}>Collections</li>}
                                {searchSuggestions.suggestedResults.collections?.map((item) => {
                                    if (item.type === 'collection') {
                                        return (
                                            <li
                                                className={style.searchSuggestionListItem}
                                                key={item.label + '' + item.id}
                                                onClick={() => onQuickSearchResultClick('collection', item)}
                                            >
                                                <span
                                                    className={style.searchSuggestionKeyword}
                                                    isfocused={currentFocusPointer.target === item.id ? 'true' : 'false'}
                                                >
                                                    <CollectionIcon isInline={true} />
                                                    {item.label}
                                                </span>
                                            </li>
                                        );
                                    }
                                })}

                                {searchSuggestions?.matchingMedia?.length > 0 && <li className={style.label}>Files</li>}
                                {searchSuggestions?.matchingMedia?.length > 0 &&
                                    searchSuggestions.matchingMedia.map((item) => {
                                        return (
                                            <li
                                                className={style.searchSuggestionListItem}
                                                key={item.id}
                                                onClick={() => onQuickSearchResultClick('file', item)}
                                            >
                                                <span
                                                    className={style.searchSuggestionVideo}
                                                    isfocused={currentFocusPointer.target === item.id ? 'true' : 'false'}
                                                >
                                                    <Thumbnail
                                                        url={item.thumbnailURL}
                                                        variant="xs"
                                                        isNsfw={item.isNsfw}
                                                        hideNsfwContent={Boolean(stateContext?.userPreferences?.hideNsfwContent)}
                                                    />
                                                    <span className="ml10">{item.name}</span>
                                                </span>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    )}
                    {searchText.length >= 2 && (
                        <div className={style.suggestionsFloatingPanelAction}>
                            <Button
                                type={'transparentBtn'}
                                onClick={() => startFullSearch(searchText)}
                                tabIndex={'-1'}
                                isfocused={currentFocusPointer.target === 'addAllResultsKey' ? 'true' : 'false'}
                            >
                                View all results
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {showResultsPanel && (
                <div className={style.searchResultsPanel}>
                    {searchSuggestions.length > 0 && (
                        <div className={style.relatedSearch}>
                            <div className={style.label}>Related Search</div>
                            <div className={style.searchSuggestionList}>
                                {searchSuggestions.map((item) => (
                                    <Chip
                                        className={style.suggestedKeywords}
                                        key={item.id}
                                        id={item.label}
                                        onSelection={(label) => setSearchText(label)}
                                    >
                                        {item.type === 'searchHistory' && <span className="mr5">&#8635;</span>}
                                        {item.label}
                                    </Chip>
                                ))}
                            </div>
                        </div>
                    )}
                    {fullSearchResults && (
                        <SearchResults
                            searchResults={fullSearchResults}
                            onSearchResultItemClick={onSearchResultItemClick}
                            createPlaylist={createPlaylist}
                            closeSearchResult={closeSearch}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
export default GlobalSearch;
