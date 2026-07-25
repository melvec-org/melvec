import React from 'react';
import styles from './FilterTabs.css';

/**
 * FilterTabs — a reusable, accessible inline tab-group component.
 *
 * Props
 * ─────
 * tabs          {Array<{ value: string, label: string }>}  List of tab items.
 * selectedTab   {string}   The `value` of the currently active tab.
 * onTabSelect   {function} Callback fired with the selected tab's `value`.
 * label         {string}   Optional accessible label for the tab-list (default: "Filter tabs").
 */
const FilterTabs = ({ tabs = [], selectedTab, onTabSelect, label = 'Filter tabs' }) => {
    const handleKeyDown = (e, value) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTabSelect(value);
        }
    };

    return (
        <div
            role="tablist"
            aria-label={label}
            className={styles.inlineTabGroup}
        >
            {tabs.map((tab) => {
                const isSelected = selectedTab === tab.value;
                return (
                    <button
                        key={tab.value}
                        role="tab"
                        aria-selected={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        className={
                            isSelected
                                ? `${styles.inlineTab} ${styles.activeTab}`
                                : styles.inlineTab
                        }
                        onClick={() => onTabSelect(tab.value)}
                        onKeyDown={(e) => handleKeyDown(e, tab.value)}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};

export default FilterTabs;
