import React from 'react';
import layoutStyles from './layout.css';

const MainPanel = ({ children }) => {
    return <div className={layoutStyles.mainPanel}>{children}</div>;
};
export default MainPanel;
