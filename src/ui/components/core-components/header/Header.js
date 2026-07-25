import React from 'react';
import style from './header.css';

const Header = ({ type = 'panelTitle', children = null }) => {
    return <div className={style[type]}>{children}</div>;
};

export default Header;
