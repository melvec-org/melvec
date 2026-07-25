import React from 'react';
import layoutStyles from './layout.css';
import {
    HeaderControlBar,
    HeaderControlBarRight,
    HeaderControlBarLeft,
} from '__components/core-components/header-control-bar/HeaderControlBar';

const Sidebar = ({ variant = 'small', children, isCollapsed = false, headerLabel = '', headerControls = null }) => {
    const collapsedClass = isCollapsed ? `${layoutStyles.collapsed}` : '';
    const variantClass = variant === 'small' ? `${layoutStyles.sideBarSmall}` : `${layoutStyles.sideBar}`;

    const classList = `${layoutStyles.sideBar} ${variantClass} ${collapsedClass}`;
    return (
        <div className={classList}>
            <HeaderControlBar overrideClass={layoutStyles.sidebarHeaderControl}>
                {headerLabel && <HeaderControlBarLeft>{headerLabel}</HeaderControlBarLeft>}
                {headerControls && <HeaderControlBarRight>{headerControls}</HeaderControlBarRight>}
            </HeaderControlBar>
            <div className={layoutStyles.sideBarContentWrapper}>{children}</div>
        </div>
    );
};
export default Sidebar;
