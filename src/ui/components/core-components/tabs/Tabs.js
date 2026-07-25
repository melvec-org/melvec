import React, { useEffect, useState } from 'react';
import styles from './Tabs.css';

const getTabHeaders = (settings, currentTabIndex, onTabChangeHandler) =>
    settings.map((item, index) => {
        const selectedHeaderClass =
            index === currentTabIndex ? `${styles.tabHeader} ${styles.tabHeaderSelected}` : `${styles.tabHeader}`;
        const tabIndexValue = index === currentTabIndex ? -1 : 0;
        return (
            <div
                className={selectedHeaderClass}
                key={item.header}
                onClick={() => onTabChangeHandler(index)}
                tabIndex={tabIndexValue}
            >
                {item.header}
            </div>
        );
    });
const getTabItems = (settings, currentTabIndex) => {
    const selectedTab = settings.filter((item, index) => {
        if (index === currentTabIndex) {
            return item;
        }
    });
    return selectedTab.map((item, index) => {
        return (
            <div className={styles.tabItem} key={item.header}>
                {item.component}
            </div>
        );
    });
};

const Tabs = ({ settings, selectedTabIndex, onTabIndexChange }) => {
    const [currentTabIndex, setCurrentTabIndex] = useState(selectedTabIndex);

    const onTabHaderClick = (index) => {
        setCurrentTabIndex(index);
        if (onTabIndexChange) onTabIndexChange(index);
    };

    useEffect(() => {
        setCurrentTabIndex(selectedTabIndex);
    }, [selectedTabIndex]);

    return (
        <div className={styles.tabs}>
            <div className={styles.tabHeaderContainer}>{getTabHeaders(settings, currentTabIndex, onTabHaderClick)}</div>
            <div className={styles.tabItemContainer}>{getTabItems(settings, currentTabIndex)}</div>
        </div>
    );
};
export default Tabs;
