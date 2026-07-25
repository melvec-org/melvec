import React from 'react';
import style from './button.css';

const AsyncButton = ({
    children,
    onClick,
    disabled = false,
    type = 'default',
    isfocused = 'false',
    state = 'default',
    labels = {
        default: 'Submit',
        progress: 'Submitting...',
        success: 'Success!',
        error: 'Error',
    },
    onReset,
}) => {
    const validStates = ['default', 'progress', 'success', 'error'];
    const buttonState = validStates.includes(state) ? state : 'default';
    const isDisabled = disabled || buttonState === 'progress';

    const buttonClass = type === 'default' ? `${style.button} ${style[buttonState]}` : `${style.button} ${style[type]}`;

    const handleClick = () => {
        if (buttonState === 'success' || buttonState === 'error') {
            if (onReset) onReset();
        } else if (buttonState === 'default' && onClick) {
            onClick();
        }
    };
    return (
        <button className={buttonClass} onClick={handleClick} disabled={disabled} isfocused={isfocused}>
            {buttonState === 'progress' && <span>...</span>}
            {buttonState === 'error' && <span>X </span>}
            {buttonState === 'success' && <span>✔ </span>}
            {labels[buttonState] || labels.default}
        </button>
    );
};

export default AsyncButton;
