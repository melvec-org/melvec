import React, { forwardRef } from 'react';
import style from './button.css';

// update with forwardref

const Button = forwardRef(({ children, onClick, disabled = false, type = 'default', isfocused = 'false', processing = false }, ref) => {
    const buttonClass = type === 'default' ? style.button : `${style.button} ${style[type]}`;
    return (
        <button className={buttonClass} onClick={onClick} disabled={disabled} isfocused={isfocused} ref={ref}>
            {children}
            {processing && (
                <span className={style.processHolder}>
                    <span className={style.processing}></span>
                </span>
            )}
        </button>
    );
});

export default Button;
