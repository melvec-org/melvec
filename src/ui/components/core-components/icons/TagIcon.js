import React from 'react';
import style from './icons.css';

const TagIcon = ({ isInline = false }) => {
    const inlineClass = isInline ? style.inlineIcon : style.icon;
    return (
        <span className={inlineClass}>
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M26 0v10l-15 14-9-8 12-12H24z" />
                <circle cx="17" cy="7" r="1.5" fill="none" />
            </svg>
        </span>
    );
};

export default TagIcon;
