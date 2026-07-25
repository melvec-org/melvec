import React from 'react';
import style from './MetaData.css';

export const MetaDataRow = ({ children }) => {
    return <div className={style.metaDataRow}>{children}</div>;
};

export const MetaDataHeader = ({ children }) => {
    return <div className={style.metaDataHeader}>{children}</div>;
};

export const MetaDataLabel = ({ children }) => {
    return <div className={style.metaDataLabel}>{children}</div>;
};

export const MetaDataValue = ({ children }) => {
    return <div className={style.metaDataValue}>{children}</div>;
};
