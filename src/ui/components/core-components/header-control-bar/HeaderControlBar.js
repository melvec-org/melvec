import React from 'react';
import style from './HeaderControlBar.css';

// Map variants to CSS classes (created once, reused)
const variantClassMap = {
    small: style.responsiveContainerSmall,
    default: '',
};

export const HeaderControlBarLeft = ({ children }) => {
    return <div className={style.headerControlBarLeft}>{children}</div>;
};
export const HeaderControlBarRight = ({ children }) => {
    return <div className={style.headerControlBarRight}>{children}</div>;
};
export const HeaderControlBar = ({ children, variant = 'default', overrideClass = '' }) => {
    const variantClass = variantClassMap[variant] || variantClassMap.default;

    const customClass = `${style.headerControlBar} ${overrideClass}`.trim();

    if (variant === '') {
        return <div className={customClass}>{children}</div>;
    } else {
        return (
            <div className={variantClass}>
                <div className={customClass}>{children}</div>
            </div>
        );
    }
};
