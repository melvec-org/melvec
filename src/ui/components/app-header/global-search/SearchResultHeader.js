import React, { useState } from 'react';
import style from './GlobalSearch.css';
import {
    HeaderControlBar,
    HeaderControlBarRight,
    HeaderControlBarLeft,
} from '__components/core-components/header-control-bar/HeaderControlBar';
import SortingSelector from '__components/core-components/sorting-selector/SortingSelector';
import FilterTabs from '__components/core-components/filter-tabs/FilterTabs';
import { useApplicationContext } from '__contexts/app.context';

const CategoryFilter = ({ categories, onChange }) => {
    return (
        <select onChange={(e) => onChange(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((category) => (
                <option key={category.id} value={category.id}>
                    {category.label}
                </option>
            ))}
        </select>
    );
};

const SearchResultHeader = ({
    searchResults,
    matchFields = [],
    selectedMatchField = null,
    onMatchFieldChange = null,
    mediaTypeFilterTabs = [],
    selectedMediaType = null,
    onMediaTypeChange = null,
    onSortingChange = null,
    onCategoryFilterChange = null,
}) => {
    const { totalCount } = searchResults;
    const [applicationState] = useApplicationContext();

    // Normalise `{ label }` items so FilterTabs always gets `{ value, label }`
    const normalisedMatchFields = matchFields.map((field) => ({
        value: field.value ?? field.label,
        label: field.label,
    }));

    return (
        <HeaderControlBar>
            <HeaderControlBarLeft>
                <h2 className={style.searchResultHeader}>
                    Top Results <span className={style.searchResultHeaderMeta}>({totalCount} matches)</span>
                </h2>
            </HeaderControlBarLeft>
            <HeaderControlBarRight>
                <CategoryFilter categories={applicationState.videoCategories} onChange={onCategoryFilterChange} />
                <SortingSelector
                    options={[
                        { value: 'relevance', label: 'Relevance' },
                        { value: 'views', label: 'Views' },
                        { value: 'fileSizeDesc', label: 'Largest first' },
                        { value: 'fileSizeAsc', label: 'Smallest first' },
                        { value: 'A_Z', label: 'File name A-Z' },
                        { value: 'Z_A', label: 'File name Z-A' },
                        { value: 'durationDesc', label: 'Longest first' },
                        { value: 'durationAsc', label: 'Sortest first' },
                        { value: 'dateAddedDesc', label: 'Newest first' },
                        { value: 'dateAddedAsc', label: 'Oldest first' },
                        { value: 'rating', label: 'Rating' },
                        { value: 'quality', label: 'Content Quality' },
                    ]}
                    placeholder={'Sort by'}
                    onChange={onSortingChange}
                />

                {totalCount > 0 && mediaTypeFilterTabs.length > 0 && (
                    <div className={'flex'}>
                        <span className={style.label}>Media type:</span>
                        <FilterTabs
                            tabs={mediaTypeFilterTabs}
                            selectedTab={selectedMediaType}
                            onTabSelect={onMediaTypeChange}
                            label="Media type filter"
                        />
                    </div>
                )}

                {totalCount > 0 && normalisedMatchFields.length > 0 && (
                    <div className={'flex'}>
                        <span className={style.label}>Matching by:</span>
                        <FilterTabs
                            tabs={normalisedMatchFields}
                            selectedTab={selectedMatchField}
                            onTabSelect={onMatchFieldChange}
                            label="Match fields filter"
                        />
                    </div>
                )}
            </HeaderControlBarRight>
        </HeaderControlBar>
    );
};

export default SearchResultHeader;
