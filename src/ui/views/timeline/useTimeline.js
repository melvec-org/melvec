import { useEffect, useRef, useState } from 'react';
import responseStatus from '__constants/responseStatus';
import { useApplicationContext } from '__contexts/app.context';
import applicationEvents from '__events/applicationEvents';

const DATE_CHANGE_SOURCE = {
    LIST: 'list',
    SCALE: 'scale',
    RESTORE: 'restore',
};

const TIMELINE_DATE_SAVE_DELAY_MS = 1000;

/**
 * Converts a Date-like timeline value to the numeric timestamp expected by application settings.
 *
 * @param {Date|number|string} value Timeline date value to normalize.
 * @returns {number|null} Numeric timestamp, or null when the value is invalid.
 */
const getTimestamp = (value) => {
    const timestamp = value instanceof Date ? value.getTime() : Number(value);
    return Number.isFinite(timestamp) ? timestamp : null;
};

/**
 * Checks whether the given timestamp belongs to a month represented by the loaded media list.
 * Timeline navigation snaps by month, so this intentionally validates month/year membership
 * instead of requiring an exact media item birthtime match.
 *
 * @param {Array<{ birthtimeMs: number|string }>} items Media items available in the timeline.
 * @param {number} timestamp Timestamp to validate.
 * @returns {boolean} True when at least one media item exists in the same month and year.
 */
const hasMediaInSameMonth = (items, timestamp) => {
    const targetDate = new Date(timestamp);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    return items.some((item) => {
        const itemTimestamp = Number(item.birthtimeMs);

        if (!Number.isFinite(itemTimestamp)) {
            return false;
        }

        const itemDate = new Date(itemTimestamp);
        return itemDate.getFullYear() === targetYear && itemDate.getMonth() === targetMonth;
    });
};

/**
 * Owns timeline data loading, current date restoration, debounced date persistence,
 * and navigation handlers.
 *
 * The hook restores `currentTimelineDateStamp` only after media is available. If the saved
 * timestamp does not belong to the loaded media list, it falls back to the first media item date.
 * Date persistence is debounced by one second to avoid repeatedly writing application settings
 * while the user scrolls the virtual list.
 *
 * `scrollToDate` is only populated when the date change should drive list scrolling, such as
 * timeline-scale navigation or restoring a saved date. List-originated date changes keep it null
 * so normal scrolling does not fight the user's scroll position.
 *
 * @returns {{
 *   mediaShortInfoList: Array<object>,
 *   error: string|null,
 *   currentDate: Date|number|null,
 *   scrollToDate: Date|number|null,
 *   getAllMediaShortInfo: Function,
 *   onMediaThumbnailClick: Function,
 *   onScaleDateChange: Function,
 *   onListVisibleDateChange: Function,
 * }} Timeline state and event handlers consumed by the Timeline view.
 */
const useTimeline = () => {
    const [mediaShortInfoList, setMediaShortInfoList] = useState([]);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(null);
    const [dateChangeSource, setDateChangeSource] = useState(null);
    const [applicationContext, dispatchContext] = useApplicationContext();
    const saveTimelineDateTimeoutRef = useRef(null);
    const pendingTimelineDateRef = useRef(null);
    const isTimelineDateInitializedRef = useRef(false);
    const isTimelineDateReadyRef = useRef(false);

    const getAllMediaShortInfo = () => {
        setError(null);

        window.api.getAllMediaShortInfo().then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                setMediaShortInfoList(response.data || []);
            } else {
                setError(response.message);
            }
        });
    };

    const saveCurrentTimelineDate = (date) => {
        const timestamp = getTimestamp(date);

        if (timestamp === null) {
            return;
        }

        pendingTimelineDateRef.current = timestamp;

        if (saveTimelineDateTimeoutRef.current) {
            clearTimeout(saveTimelineDateTimeoutRef.current);
        }

        saveTimelineDateTimeoutRef.current = setTimeout(() => {
            window.api.setApplicationSettings('currentTimelineDateStamp', pendingTimelineDateRef.current);
            saveTimelineDateTimeoutRef.current = null;
            pendingTimelineDateRef.current = null;
        }, TIMELINE_DATE_SAVE_DELAY_MS);
    };

    const onMediaThumbnailClick = (media) => {
        const mediaId = media.mediaId || media.id;

        if (!media.mediaType || !mediaId) {
            alert('Invalid media selected');
            return;
        }

        window.api.getMediaBasicDetails(media.mediaType, mediaId).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                const data = response.data;
                if (data) {
                    const collectionToJump = applicationContext.collections.find((item) => item.id === data.collectionId);
                    dispatchContext({
                        type: applicationEvents.GOTO_COLLECTION,
                        payload: {
                            selectedCollection: collectionToJump,
                            selectedVideoId: data.id,
                        },
                    });
                }
            } else {
                alert(response.message);
            }
        });
    };

    const onScaleDateChange = (date) => {
        setDateChangeSource(DATE_CHANGE_SOURCE.SCALE);
        setCurrentDate(date);
        saveCurrentTimelineDate(date);
    };

    const onListVisibleDateChange = (date) => {
        if (!isTimelineDateReadyRef.current) {
            return;
        }

        setDateChangeSource(DATE_CHANGE_SOURCE.LIST);
        setCurrentDate(date);
        saveCurrentTimelineDate(date);
    };

    useEffect(() => {
        getAllMediaShortInfo();
    }, []);

    useEffect(() => {
        let isActive = true;

        if (isTimelineDateInitializedRef.current || !mediaShortInfoList.length) {
            return;
        }

        isTimelineDateInitializedRef.current = true;

        const firstMediaItem = mediaShortInfoList[0];
        const firstMediaBirthtimeMs = Number(firstMediaItem.birthtimeMs);

        window.api.getApplicationSettings('currentTimelineDateStamp').then((data) => {
            // safeguard if there is quick switch of mount/unmount
            if (!isActive) {
                return;
            }

            const savedTimelineDateStamp = Number(data);

            if (Number.isFinite(savedTimelineDateStamp) && hasMediaInSameMonth(mediaShortInfoList, savedTimelineDateStamp)) {
                setDateChangeSource(DATE_CHANGE_SOURCE.RESTORE);
                setCurrentDate(savedTimelineDateStamp);
                isTimelineDateReadyRef.current = true;
                return;
            }

            if (Number.isFinite(firstMediaBirthtimeMs)) {
                setDateChangeSource(DATE_CHANGE_SOURCE.RESTORE);
                setCurrentDate(firstMediaBirthtimeMs);
                isTimelineDateReadyRef.current = true;
            }
        });
        return () => {
            isActive = false;
        };
    }, [mediaShortInfoList]);

    useEffect(() => {
        return () => {
            if (saveTimelineDateTimeoutRef.current) {
                clearTimeout(saveTimelineDateTimeoutRef.current);
            }
        };
    }, []);

    return {
        mediaShortInfoList,
        error,
        currentDate,
        scrollToDate: dateChangeSource === DATE_CHANGE_SOURCE.SCALE || dateChangeSource === DATE_CHANGE_SOURCE.RESTORE ? currentDate : null,
        getAllMediaShortInfo,
        onMediaThumbnailClick,
        onScaleDateChange,
        onListVisibleDateChange,
    };
};

export default useTimeline;
