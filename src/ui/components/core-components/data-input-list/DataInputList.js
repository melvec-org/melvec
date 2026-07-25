import React, { forwardRef, useMemo } from 'react';
import style from './DataInputList.css';

const DataInputList = forwardRef(
    (
        {
            id = '',
            inputList = [],
            defaultValue = '',
            value = '',
            onChangeHandler = null,
            placeholder = '',
            onSelectChange = null,
        },
        ref,
    ) => {
        // create a memoized function that would create options based on inputlist to avoid any rerender everytime.
        const options = useMemo(() => {
            return inputList.map((item) => {
                return <option key={item.id} value={item.label} />;
            });
        }, [inputList]);

        const onKeyDown = (e) => {
            if (e.key === 'Enter' && e.target.value.trim() !== '') {
                onSelectChange(e.target.value);
            }
        };

        return (
            <div className={style.dataInputList}>
                <input
                    list={`data_${id}`}
                    name={id}
                    id={id}
                    value={value}
                    onChange={(event) => onChangeHandler(event.target.value)}
                    spellCheck={false}
                    type={'text'}
                    maxLength={80}
                    minLength={2}
                    placeholder={placeholder}
                    onKeyDown={(e) => onKeyDown(e)}
                    ref={ref}
                />
                <datalist id={`data_${id}`}>{options}</datalist>
            </div>
        );
    },
);

export default DataInputList;
