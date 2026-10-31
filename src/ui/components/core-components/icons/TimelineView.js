import React from 'react';
import style from './icons.css';

const TimelineViewIcon = () => {
    return (
        <span className={style.icon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <g transform="scale(0.046875)">
                    <g transform="scale(-1,1) translate(-512,0)">
                        <rect x="210" y="90" width="130" height="70" rx="15" ry="15" />

                        <rect x="20" y="90" width="130" height="70" rx="15" ry="15" />

                        <rect x="210" y="235" width="130" height="70" rx="15" ry="15" />

                        <rect x="20" y="235" width="130" height="70" rx="15" ry="15" />

                        <rect x="210" y="370" width="130" height="70" rx="15" ry="15" />

                        <rect x="20" y="370" width="130" height="70" rx="15" ry="15" />

                        <path d="M482.59 336.88l-.01 122.37c0 9.47-8.53 17.15-19.05 17.15-9.64 0-17.61-6.44-18.87-14.81l-.17-2.33-.01-122.12a76.4 76.4 0 0 0 18.52 2.04c6.78-.01 13.34-.81 19.59-2.3m-19.05-109.78c26.76 0 48.45 19.52 48.45 43.61s-21.69 43.61-48.45 43.61S415.1 294.8 415.1 270.71s21.69-43.61 48.45-43.61M463.56 49.11c9.64 0 17.61 6.45 18.87 14.81l.17 2.32v122.17a76.2 76.2 0 0 0-19.58-2.29c-6.39 0-12.6.71-18.52 2.04l.02-121.92c-.01-9.46 8.52-17.13 19.04-17.13" />
                    </g>
                </g>
            </svg>
        </span>
    );
};

export default TimelineViewIcon;
