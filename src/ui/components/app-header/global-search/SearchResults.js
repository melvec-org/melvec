import React, { useEffect, useState } from 'react';
import style from './GlobalSearch.css';
import SearchResultHeader from './SearchResultHeader';
import ResultTiles from './ResultTiles.js';
import Button from '__components/core-components/button/Button.js';
import sortVideoList from '__utils/sortVideoList';
import mediaTypes from '__constants/mediaTypes';

const filterLabels = {
    TAGS: 'Tags',
    TITLES: 'Titles',
    FILE_NAMES: 'File names',
    CONTENT: 'Content',
};

const mediaTypeFilterTabs = [
    { value: mediaTypes.VIDEO, label: 'Video' },
    { value: mediaTypes.IMAGE, label: 'Image' },
    { value: mediaTypes.AUDIO, label: 'Audio' },
];

const SearchResults = ({ searchResults, onSearchResultItemClick, createPlaylist, searchText, closeSearchResult }) => {
    const [selectedMatchField, setSelectedMatchField] = useState(null);
    const [selectedMediaType, setSelectedMediaType] = useState(null);
    const [filteredResults, setFilteredResults] = useState([]);
    const [searchResultsData, setSearchResultsData] = useState(null);
    const [sortBy, setSortBy] = useState('');
    const [matchFields, setMatchFields] = useState([]);
    const [categoryBy, setCategoryBy] = useState('');

    const applySorting = (results, sortBy) => {
        if (sortBy === '') return results;
        return [...sortVideoList(results, sortBy)];
    };

    const applyFilter = (searchResults, filterLabel) => {
        if (!filterLabel) return [];
        if (filterLabel === filterLabels.TAGS) return searchResults.byTags || [];
        if (filterLabel === filterLabels.TITLES) return searchResults.byTitles || [];
        if (filterLabel === filterLabels.FILE_NAMES) return searchResults.byFileNames || [];
        if (filterLabel === filterLabels.CONTENT) return searchResults.byContent || [];
        return [];
    };

    const applyFilterByCategory = (results, categoryBy) => {
        if (!categoryBy || categoryBy === '') return results;
        return results.filter((media) => media.categoryId === categoryBy);
    };

    const applyFilterByMediaType = (results, mediaType) => {
        if (!mediaType) return results;
        return results.filter((media) => media.mediaType === mediaType);
    };

    useEffect(() => {
        if (!searchResultsData || !selectedMatchField) return;

        let filteredData = applyFilter(searchResultsData, selectedMatchField);
        filteredData = applyFilterByMediaType(filteredData, selectedMediaType);
        filteredData = applyFilterByCategory(filteredData, categoryBy);
        filteredData = applySorting(filteredData, sortBy);

        setFilteredResults(filteredData);
    }, [searchResultsData, selectedMatchField, selectedMediaType, sortBy, categoryBy]);

    useEffect(() => {
        if (!searchResults) return;

        setSearchResultsData(searchResults);
        setCategoryBy('');
        setSortBy('');

        if (searchResults.totalCount > 0) {
            const tabs = [];

            if (searchResults.byTags.length > 0) tabs.push({ label: filterLabels.TAGS, count: searchResults.byTags.length });
            if (searchResults.byTitles.length > 0) tabs.push({ label: filterLabels.TITLES, count: searchResults.byTitles.length });

            if (searchResults.byFileNames.length > 0)
                tabs.push({ label: filterLabels.FILE_NAMES, count: searchResults.byFileNames.length });

            if (searchResults.byContent.length > 0) tabs.push({ label: filterLabels.META_DATA, count: searchResults.byContent.length });

            setMatchFields(tabs);
            setSelectedMatchField(tabs[0]?.label ?? null);
            setSelectedMediaType(null);
            setFilteredResults([]);
        } else {
            setMatchFields([]);
            setSelectedMatchField(null);
            setSelectedMediaType(null);
            setFilteredResults([]);
        }
    }, [searchResults]);

    if (searchResultsData === null) {
        return;
    }

    if (searchResultsData.totalCount === 0) {
        return (
            <div className={style.searchResults}>
                <div className={style.noResultsFound}>No results found for {searchText}. Try modifying your search keyword/s.</div>
            </div>
        );
    } else {
        return (
            <div id="searchResults" className={style.searchResults}>
                <SearchResultHeader
                    searchResults={searchResultsData}
                    matchFields={matchFields}
                    selectedMatchField={selectedMatchField}
                    onMatchFieldChange={setSelectedMatchField}
                    mediaTypeFilterTabs={mediaTypeFilterTabs}
                    selectedMediaType={selectedMediaType}
                    onMediaTypeChange={setSelectedMediaType}
                    onSortingChange={(sortBy) => setSortBy(sortBy)}
                    onCategoryFilterChange={(category) => setCategoryBy(category)}
                />
                <div id="searchResultsList" className={style.searchResultsContent}>
                    {filteredResults.length > 0 && (
                        <ResultTiles resultList={filteredResults} onSearchResultItemClick={onSearchResultItemClick} />
                    )}
                    {filteredResults.length === 0 && (
                        <div className={style.noResultsFound}>
                            No results found for {searchText}. Try modifying your search keyword/s or filters.
                        </div>
                    )}
                </div>
                <div className={style.searchResultsActions}>
                    {searchResultsData.totalCount > 0 && (
                        <Button className="button" id="createNewPlaylistFromSearch" onClick={() => createPlaylist(filteredResults)}>
                            Create a new playlist from here
                        </Button>
                    )}
                    <Button onClick={() => closeSearchResult()}>Close this search</Button>
                </div>
            </div>
        );
    }
};

export default SearchResults;
