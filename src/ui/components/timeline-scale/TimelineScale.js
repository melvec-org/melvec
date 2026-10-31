import React, { useEffect, useMemo, useState } from 'react';
import TimelineScaleCanvas from './TimelineScaleCanvas';
import style from './TimelineScale.css';

const MONTH_COUNT = 12;

const getValidMediaDates = (items = []) => {
    return items
        .map((item) => {
            const timestamp = Number(item.birthtimeMs);
            return Number.isFinite(timestamp) ? new Date(timestamp) : null;
        })
        .filter((date) => date && Number.isFinite(date.getTime()));
};

const getYearScale = (items = []) => {
    const mediaDates = getValidMediaDates(items);

    if (!mediaDates.length) {
        return [];
    }

    const years = mediaDates.map((date) => date.getFullYear());
    const oldestYear = Math.min(...years);
    const newestYear = Math.max(...years);
    const mediaCountByYear = mediaDates.reduce((acc, date) => {
        const year = date.getFullYear();
        const month = date.getMonth();

        if (!acc[year]) {
            acc[year] = {
                year,
                mediaCount: 0,
                monthlyCount: Array(MONTH_COUNT).fill(0),
            };
        }

        acc[year].mediaCount += 1;
        acc[year].monthlyCount[month] += 1;

        return acc;
    }, {});
    const totalMediaCount = mediaDates.length;

    const scale = [];
    for (let year = newestYear; year >= oldestYear; year -= 1) {
        const yearData = mediaCountByYear[year] || {
            year,
            mediaCount: 0,
            monthlyCount: Array(MONTH_COUNT).fill(0),
        };

        scale.push({
            ...yearData,
            percentage: totalMediaCount ? (yearData.mediaCount / totalMediaCount) * 100 : 0,
        });
    }

    return scale;
};

const TimelineScale = ({ items = [], currentDate = null, onDateChange = null }) => {
    const yearScale = useMemo(() => getYearScale(items), [items]);
    const [internalCurrentDate, setInternalCurrentDate] = useState(currentDate);

    useEffect(() => {
        setInternalCurrentDate(currentDate);
    }, [currentDate]);

    const handleDateChange = (date) => {
        setInternalCurrentDate(date);

        if (onDateChange) {
            onDateChange(date);
        }
    };

    return (
        <div className={style.timelineScaleContainer}>
            <TimelineScaleCanvas yearScale={yearScale} currentDate={internalCurrentDate} onDateChange={handleDateChange} />
        </div>
    );
};

export default TimelineScale;
