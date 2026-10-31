import React from 'react';
import DashboardLayout from '__components/layouts/DashboardLayout';
import TimelineScale from '__components/timeline-scale/TimelineScale';
import MainPanel from '__components/layouts/MainPanel';
import VirtualList from '__components/virtual-list/VirtualList';
import useTimeline from './useTimeline';

const Timeline = () => {
    const {
        mediaShortInfoList,
        error,
        currentDate,
        scrollToDate,
        onMediaThumbnailClick,
        onScaleDateChange,
        onListVisibleDateChange,
    } = useTimeline();

    return (
        <DashboardLayout>
            <TimelineScale items={mediaShortInfoList} currentDate={currentDate} onDateChange={onScaleDateChange} />
            <MainPanel>
                {error ? (
                    <div>{error}</div>
                ) : (
                    <VirtualList
                        items={mediaShortInfoList}
                        scrollToDate={scrollToDate}
                        onVisibleDateChange={onListVisibleDateChange}
                        onListItemClick={onMediaThumbnailClick}
                    />
                )}
            </MainPanel>
        </DashboardLayout>
    );
};

export default Timeline;
