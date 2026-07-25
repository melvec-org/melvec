const LRUCache = require('../service-utils/LRUCache');
const serviceEventBus = require('../service-utils/serviceEventBus');
const interServiceEvents = require('../../events/interServiceEvents');
const { getDb } = require('../database/database');

const CACHE_SIZE = 2000;
const metricsCache = new LRUCache(CACHE_SIZE);
let db = null;

/**
 * Ensures the database connection has been initialized before any operation runs.
 *
 * @throws {Error} If the database has not been initialized.
 * @returns {void}
 */
const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
};

/**
 * Inserts a new video metrics record into the database and cache.
 *
 * If values are not provided, defaults are used for views, rating, and content quality.
 *
 * @param {{
 *   video_id: string,
 *   views?: number,
 *   rating?: number|null,
 *   content_quality?: number|null
 * }} videoMetrics - Metrics payload for a video.
 * @returns {string} The inserted video id.
 * @throws {Error} If validation fails or the insert operation fails.
 */
const addVideoMetrics = (videoMetrics) => {
    ensureDbInitialized();
    const { video_id, views = 0, rating = 0, content_quality = 0 } = videoMetrics;

    // Validation
    if (!video_id || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }
    if (!Number.isInteger(views) || views < 0) {
        throw new Error('Field views must be a non-negative integer');
    }
    if (rating !== null && (!Number.isInteger(rating) || rating < 0 || rating > 10)) {
        throw new Error('Field rating must be an integer between 0 and 10 or null');
    }
    if (content_quality !== null && (!Number.isInteger(content_quality) || content_quality < 0)) {
        throw new Error('Field content_quality must be a non-negative integer or null');
    }

    const stmt = db.prepare(`
        INSERT INTO video_metrics (video_id, views, rating, content_quality)
        VALUES (?, ?, ?, ?)
    `);

    try {
        db.transaction(() => {
            stmt.run(video_id, views, rating, content_quality);
            metricsCache.set(video_id, { video_id, views, rating, content_quality });
        })();
        return video_id;
    } catch (err) {
        throw new Error(`Failed to add videoMetrics for video ${video_id}: ${err.message}`);
    }
};

/**
 * Checks whether a metrics record exists for the given video id.
 *
 * @param {string} video_id - Video identifier.
 * @returns {Object|null} Existing database row if found, otherwise null/undefined.
 */
const checkForRecord = (video_id) => {
    // Check if video_id exists in video_metrics
    const videoMetricsExistsStmt = db.prepare('SELECT video_id FROM video_metrics WHERE video_id = ?');
    const videoMetricsExists = videoMetricsExistsStmt.get(video_id);

    return videoMetricsExists;
};

/**
 * Updates the total view count for a video.
 *
 * If no metrics record exists yet, one is created with the provided views count.
 *
 * @param {string} video_id - Video identifier.
 * @param {number} views - New absolute view count.
 * @returns {boolean} True if the update or insert succeeded.
 * @throws {Error} If validation fails or the database operation fails.
 */
const updateViews = (video_id, views) => {
    ensureDbInitialized();
    // Validation
    if (!video_id || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }
    if (!Number.isInteger(views) || views < 0) {
        throw new Error('Field views must be a non-negative integer');
    }
    const isExistingData = checkForRecord(video_id);

    const stmt = db.prepare(`
        UPDATE video_metrics
        SET views = ?
        WHERE video_id = ?
    `);

    try {
        const info = db.transaction(() => {
            if (!isExistingData) {
                addVideoMetrics({ video_id: video_id, views: views });
            } else {
                const result = stmt.run(views, video_id);
                if (result.changes > 0) {
                    const videoMetrics = getVideoMetricsByVideoId(video_id);
                    if (videoMetrics) {
                        metricsCache.set(video_id, { ...videoMetrics, views });
                    }
                }
                return result;
            }
            // If we inserted, simulate UPDATE behavior
            return { changes: 1 };
        })();
        return info.changes > 0 || !videoMetricsExists;
    } catch (err) {
        throw new Error(`Failed to update views for video ${video_id}: ${err.message}`);
    }
};
/**
 * Increments the view count for a video by one.
 *
 * If no metrics record exists yet, one is created with an initial view count of 1.
 *
 * @param {string} video_id - Video identifier.
 * @returns {boolean} True if the increment or insert succeeded.
 * @throws {Error} If validation fails or the database operation fails.
 */
const increaseViewsByOne = (video_id) => {
    ensureDbInitialized();

    // Validation
    if (!video_id || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }

    const isExistingData = checkForRecord(video_id);

    const stmt = db.prepare(`
        UPDATE video_metrics
        SET views = views + 1
        WHERE video_id = ?
    `);

    try {
        const info = db.transaction(() => {
            if (!isExistingData) {
                addVideoMetrics({ video_id: video_id, views: 1 });
            } else {
                const result = stmt.run(video_id);
                if (result.changes > 0) {
                    const videoMetrics = getVideoMetricsByVideoId(video_id);
                    if (videoMetrics) {
                        metricsCache.set(video_id, { ...videoMetrics, views: videoMetrics.views + 1 });
                    }
                }
                return result;
            }
            return { changes: 1 };
        })();
        return info.changes > 0;
    } catch (err) {
        throw new Error(`Failed to increase views for video ${video_id}: ${err.message}`);
    }
};

/**
 * Retrieves metrics for a video by id.
 *
 * Results are served from the in-memory cache when available, otherwise fetched
 * from the database and then cached.
 *
 * @param {string} video_id - Video identifier.
 * @returns {{video_id: string, views: number, rating: number|null, content_quality: number|null}|null}
 * Video metrics record or null if not found.
 * @throws {Error} If the database query fails.
 */
const getVideoMetricsByVideoId = (video_id) => {
    ensureDbInitialized();
    const cached = metricsCache.get(video_id);
    if (cached) {
        return cached;
    }

    try {
        const stmt = db.prepare('SELECT * FROM video_metrics WHERE video_id = ?');
        const videoMetrics = stmt.get(video_id);

        if (videoMetrics) {
            metricsCache.set(video_id, videoMetrics);
        }

        return videoMetrics || null;
    } catch (err) {
        throw new Error(`Error fetching videoMetrics for video ${video_id}: ${err.message}`);
    }
};

/**
 * Updates the content rating for a video.
 *
 * If no metrics record exists yet, one is created with the provided rating.
 *
 * @param {string} video_id - Video identifier.
 * @param {number|null} rating - Rating value between 0 and 10, or null.
 * @returns {boolean} True if the update or insert succeeded.
 * @throws {Error} If validation fails or the database operation fails.
 */
const updateContentRating = (video_id, rating) => {
    ensureDbInitialized();
    // Validation
    if (!video_id || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }
    if (rating !== null && (!Number.isInteger(rating) || rating < 0 || rating > 10)) {
        throw new Error('Field rating must be an integer between 0 and 10 or null');
    }
    const isExistingData = checkForRecord(video_id);

    const stmt = db.prepare(`
        UPDATE video_metrics
        SET rating = ?
        WHERE video_id = ?
    `);

    try {
        const info = db.transaction(() => {
            if (!isExistingData) {
                addVideoMetrics({ video_id, rating });
            } else {
                const result = stmt.run(rating, video_id);
                if (result.changes > 0) {
                    const videoMetrics = getVideoMetricsByVideoId(video_id);
                    if (videoMetrics) {
                        metricsCache.set(video_id, { ...videoMetrics, rating });
                    }
                }
                return result;
            }
            // If we inserted, simulate UPDATE behavior
            return { changes: 1 };
        })();
        return info.changes > 0 || !videoMetricsExists;
    } catch (err) {
        throw new Error(`Failed to update rating for video ${video_id}: ${err.message}`);
    }
};

/**
 * Updates the content quality score for a video.
 *
 * If no metrics record exists yet, one is created with the provided quality value.
 *
 * @param {string} video_id - Video identifier.
 * @param {number|null} content_quality - Non-negative integer quality score, or null.
 * @returns {boolean} True if the update or insert succeeded.
 * @throws {Error} If validation fails or the database operation fails.
 */
const updateContentQuality = (video_id, content_quality) => {
    ensureDbInitialized();
    // Validation
    if (!video_id || typeof video_id !== 'string' || video_id.trim() === '') {
        throw new Error('Field video_id must be a non-empty string');
    }

    if (content_quality !== null && (!Number.isInteger(content_quality) || content_quality < 0)) {
        throw new Error('Field content_quality must be a non-negative integer or null');
    }
    const isExistingData = checkForRecord(video_id);

    const stmt = db.prepare(`
        UPDATE video_metrics
        SET content_quality = ?
        WHERE video_id = ?
    `);

    try {
        const info = db.transaction(() => {
            if (!isExistingData) {
                addVideoMetrics({ video_id, content_quality });
            } else {
                const result = stmt.run(content_quality, video_id);
                if (result.changes > 0) {
                    const videoMetrics = getVideoMetricsByVideoId(video_id);
                    if (videoMetrics) {
                        metricsCache.set(video_id, { ...videoMetrics, content_quality });
                    }
                }
                return result;
            }
            // If we inserted, simulate UPDATE behavior
            return { changes: 1 };
        })();
        return info.changes > 0 || !videoMetricsExists;
    } catch (err) {
        throw new Error(`Failed to update content quality for video ${video_id}: ${err.message}`);
    }
};

/**
 * Handles video deletion events by removing the deleted video's metrics from cache.
 *
 * @param {{videoId: string}} payload - Event payload containing the deleted video id.
 * @returns {void}
 */
const onVideoDelete = ({ videoId }) => {
    metricsCache.delete(videoId);
};

/**
 * Returns all videos with a non-null rating, sorted by rating descending and then
 * by views descending for tie-breaking.
 *
 * @returns {Array<{video_id: string, views: number, rating: number|null, content_quality: number|null}>}
 * Sorted list of rated videos.
 * @throws {Error} If the database query fails.
 */
const getTopRatedVideosList = () => {
    ensureDbInitialized();
    try {
        const stmt = db.prepare('SELECT * FROM video_metrics WHERE rating IS NOT NULL');
        const videos = stmt.all();

        // Sort by rating (descending), then by views (descending) for ties
        const sortedVideos = videos.sort((a, b) => {
            if (a.rating !== b.rating) {
                return b.rating - a.rating; // Higher rating first
            }
            return b.views - a.views; // Higher views first for same rating
        });

        // Update cache for each video
        sortedVideos.forEach((video) => {
            metricsCache.set(video.video_id, video);
        });

        return sortedVideos;
    } catch (err) {
        throw new Error(`Error fetching top-rated videos: ${err.message}`);
    }
};

/**
 * Returns all videos sorted by view count in descending order.
 *
 * @returns {Array<{video_id: string, views: number, rating: number|null, content_quality: number|null}>}
 * Sorted list of videos by views.
 * @throws {Error} If the database query fails.
 */
const getMostViewedVideos = () => {
    ensureDbInitialized();
    try {
        const stmt = db.prepare('SELECT * FROM video_metrics');
        const videos = stmt.all();

        // Sort by views (descending)
        const sortedVideos = videos.sort((a, b) => b.views - a.views);

        // Update cache for each video
        sortedVideos.forEach((video) => {
            metricsCache.set(video.video_id, video);
        });

        return sortedVideos;
    } catch (err) {
        throw new Error(`Error fetching most viewed videos: ${err.message}`);
    }
};

/**
 * Clears the in-memory video metrics cache.
 *
 * @returns {void}
 */
const clearVideoMetricsDbCache = () => metricsCache.clear();

/**
 * Initializes the video metrics service.
 *
 * This loads the current database instance, clears the cache, and subscribes to
 * inter-service events for database reinitialization and video deletion.
 *
 * @returns {void}
 */
const initVideoMetricsService = () => {
    // in case of re-initialization of the video library
    db = getDb();
    serviceEventBus.subscribe(interServiceEvents.DATABASE_INITIALIZED, ({ db: newDb }) => {
        db = newDb;
    });
    metricsCache.clear();

    serviceEventBus.subscribe(interServiceEvents.DELETE_VIDEO, onVideoDelete);
};

module.exports = {
    initVideoMetricsService,
    getTopRatedVideosList,
    getMostViewedVideos,
    updateContentQuality,
    updateContentRating,
    updateViews,
    getVideoMetricsByVideoId,
    addVideoMetrics,
    increaseViewsByOne,
    clearVideoMetricsDbCache,
};
