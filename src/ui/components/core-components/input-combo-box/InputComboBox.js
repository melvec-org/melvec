import React, { useCallback, useEffect, useRef, useState } from 'react';
import style from './InputComboBox.css';
import keyCodes from '__constants/keyCodes';

/**
 * InputComboBox — generic read-only combobox with a dropdown option list.
 *
 * Props:
 *   value        {string}                 — currently selected value (controls the input display)
 *   options      {Array<{label, value}>}  — list of items shown in the dropdown
 *   placeholder  {string}                 — shown when value is empty
 *   emptyText    {string}                 — shown inside the dropdown when options is empty
 *   className    {string}                 — extra class applied to the wrapper div
 *   inputClassName {string}               — extra class applied to the input element
 *   id           {string}                 — forwarded as the input's id (for <label htmlFor>)
 *   onSelect     {(value) => void}        — called with the selected option's value
 *
 * Keyboard:
 *   Enter / Space / ↓  — open dropdown (when input focused)
 *   ↓ / ↑              — move highlight
 *   Enter / Space       — confirm highlighted option
 *   Escape / Tab        — close without selecting
 */
const InputComboBox = ({
    value = '',
    options = [],
    placeholder = 'Select an option',
    emptyText = 'No options available',
    className = '',
    inputClassName = '',
    id,
    onSelect,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const wrapperRef = useRef(null);
    const listRef = useRef(null);

    const openDropdown = useCallback(() => {
        if (options.length === 0) return;
        setHighlightedIndex(-1);
        setIsOpen(true);
    }, [options.length]);

    const closeDropdown = useCallback(() => {
        setIsOpen(false);
        setHighlightedIndex(-1);
    }, []);

    const selectOption = useCallback(
        (optionValue) => {
            closeDropdown();
            onSelect?.(optionValue);
        },
        [closeDropdown, onSelect],
    );

    // Close when clicking/tapping outside the component
    useEffect(() => {
        const handlePointerDown = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                closeDropdown();
            }
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [closeDropdown]);

    // Keep highlighted item visible while navigating
    useEffect(() => {
        if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
        listRef.current.children[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex, isOpen]);

    const moveHighlight = (direction) => {
        setHighlightedIndex((prev) => {
            const next = prev + direction;
            return Math.max(0, Math.min(next, options.length - 1));
        });
    };

    const handleInputKeyDown = (e) => {
        switch (e.key) {
            case keyCodes.ENTER:
            case keyCodes.SPACE:
                e.preventDefault();
                if (!isOpen) {
                    openDropdown();
                } else if (highlightedIndex >= 0) {
                    selectOption(options[highlightedIndex].value);
                }
                break;
            case keyCodes.ARROW_DOWN:
                e.preventDefault();
                if (!isOpen) {
                    openDropdown();
                } else {
                    moveHighlight(1);
                }
                break;
            case keyCodes.ARROW_UP:
                e.preventDefault();
                if (isOpen) moveHighlight(-1);
                break;
            case keyCodes.ESCAPE:
                closeDropdown();
                break;
            default:
                break;
        }
    };

    const handleOptionKeyDown = (e, optionValue) => {
        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                selectOption(optionValue);
                break;
            case 'ArrowDown':
                e.preventDefault();
                moveHighlight(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                moveHighlight(-1);
                break;
            case 'Escape':
            case 'Tab':
                closeDropdown();
                break;
            default:
                break;
        }
    };

    const listboxId = id ? `${id}-listbox` : 'input-combo-box-listbox';

    return (
        <div
            ref={wrapperRef}
            className={`${style.comboBoxWrapper}${className ? ` ${className}` : ''}`}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-owns={listboxId}
        >
            <input
                id={id}
                type="text"
                readOnly
                className={`${style.comboBoxInput}${inputClassName ? ` ${inputClassName}` : ''}`}
                value={value}
                placeholder={placeholder}
                aria-label={placeholder}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
                onClick={openDropdown}
                onFocus={openDropdown}
                onKeyDown={handleInputKeyDown}
            />

            {isOpen && (
                <ul id={listboxId} ref={listRef} role="listbox" className={style.comboBoxDropdown}>
                    {options.length === 0 ? (
                        <li className={style.comboBoxEmpty} role="option" aria-disabled="true">
                            {emptyText}
                        </li>
                    ) : (
                        options.map((option, index) => (
                            <li
                                key={option.value}
                                id={`${listboxId}-option-${index}`}
                                role="option"
                                aria-selected={option.value === value}
                                tabIndex={highlightedIndex === index ? 0 : -1}
                                title={option.label}
                                className={`${style.comboBoxOption}${highlightedIndex === index ? ` ${style.comboBoxOptionHighlighted}` : ''}`}
                                onPointerDown={(e) => {
                                    // pointerdown fires before blur, preventing the list from closing prematurely
                                    e.preventDefault();
                                    selectOption(option.value);
                                }}
                                onKeyDown={(e) => handleOptionKeyDown(e, option.value)}
                            >
                                {option.label}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

export default InputComboBox;
