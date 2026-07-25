import React from 'react';
import style from './icons.css';

const DashboardIcon = () => {
    return (
        <span className={style.icon}>
            <svg viewBox="0 0 24 24">
                <path d="M5.5 4a1.5 1.485 0 1 0 0 2.97A1.5 1.485 0 0 0 5.5 4m0 5.937a1.5 1.485 0 1 0 0 2.969 1.5 1.485 0 0 0 0-2.97m0 5.937a1.5 1.485 0 1 0 0 2.97 1.5 1.485 0 0 0 0-2.97m4.667-.821v4.123H11v-3.298h4.998v2.474H14.33v-.824l-2.498 1.236L14.33 20v-.824h2.499v-4.123h-6.664" />
                <g transform="matrix(.8787 0 0 .98943 -267.336 -527.075)">
                    <rect rx=".646" width="12.513" height="1.293" x="314.49" y="537.66" />
                    <rect rx=".646" width="12.513" height="1.293" x="314.49" y="543.66" />
                </g>
            </svg>
        </span>
    );
};

export default DashboardIcon;
