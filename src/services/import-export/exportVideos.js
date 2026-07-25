const fsExtra = require('fs-extra');
const path = require('path');
const serviceEventBus = require('../service-utils/serviceEventBus');
const mainThreadEvents = require('../../events/mainThreadEvents');
const libraryDbService = require('../database/videoLibraryDbService');
const { logLibraryError } = require('../logs/logService');
const getUniqueID = require('../service-utils/getUniqueID');
const { getLibDir } = require('../servicePathConfig');
const { getVideosByCollections } = require('../collections/collections');
const { getVideoDetailsById } = require('../video-library/videoLibrary');
const { doesDirectoryExist } = require('../service-utils/fileUtils');

const { streamToUI } = require('../service-utils/sendToUI');

const statusMap = {
    IDLE: 'idle',
    IN_PROGRESS: 'inProgress',
    PAUSED: 'paused',
    STOPPED: 'stopped',
    FAILURE: 'failed',
    SUCCESS: 'success',
    PARTIALLY_SUCCESS: 'partiallySuccess',
};

let state = {
    status: 'idle',
    totalVideos: 0,
    backedupVideos: 0,
    statusMessage: 'Exporting not started',
    isPaused: false,
    isStopped: false,
};

const emitStatus = (newState) => {
    state = { ...state, ...newState };
    serviceEventBus.publish(mainThreadEvents.VIDEO_EXPORT_PROGRESS, state);
    streamToUI(mainThreadEvents.VIDEO_EXPORT_PROGRESS, state);

    return state;
};
const resetState = () => {
    state = {
        status: 'idle',
        totalVideos: 0,
        backedupVideos: 0,
        statusMessage: 'Exporting not started',
        isPaused: false,
        isStopped: false,
    };
};

const startExporting = async (config) => {
    // reset the tracking id.
    if (!state.trackingId || state.trackingId !== config.trackingId) {
        resetState();
    }

    const { destinationPath, collectionsList, trackingId = getUniqueID(), sourceDirectory } = config;

    let exportingTrackingId = trackingId;
    sourceBasePath = sourceDirectory || getLibDir();

    // check if sourceBasePath and destinationPath exist.
    const isDestinationPathExists = doesDirectoryExist(destinationPath);
    if (!isDestinationPathExists) {
        return emitStatus({
            status: 'failure',
            statusMessage: 'destination path does not exist',
            trackingId: exportingTrackingId,
        });
    }

    // return a error message if we retrigger the exporting service while it's running
    if (state.status === statusMap.IN_PROGRESS) {
        return emitStatus({
            status: 'failure',
            statusMessage: 'Exporting already in progress',
            trackingId: exportingTrackingId,
        });
    }
    // set the initial state of the exporting process.
    state = emitStatus({
        status: statusMap.IN_PROGRESS,
        totalVideos: 0,
        backedupVideos: 0,
        statusMessage: 'Initializing exporting...',
        trackingId: exportingTrackingId,
    });

    // publish the event so that all impacted areas are notified.
    // this may mean all the other services should freeze to do any other operation.
    serviceEventBus.publish(mainThreadEvents.VIDEO_EXPORT_STARTED, state);

    try {
        let videos;

        if (collectionsList !== null && collectionsList.length > 0) {
            const videosIds = getVideosByCollections(collectionsList);
            videos = videosIds.map((item) => getVideoDetailsById(item));
        } else {
            videos = await libraryDbService.getAllVideos();
        }

        state = emitStatus({ totalVideos: videos.length });

        if (videos.length === 0) {
            return emitStatus({
                status: statusMap.SUCCESS,
                statusMessage: 'No videos to exporting',
                trackingId: exportingTrackingId,
            });
        }

        await fsExtra.ensureDir(destinationPath);

        let errorMovingFile = [];
        for (const video of videos) {
            // for debugging use some timeout to simulate delay
            //await timeout(1000);
            if (state.isStopped) {
                return emitStatus({
                    status: statusMap.STOPPED,
                    statusMessage: 'Exporting stopped by user',
                    trackingId: exportingTrackingId,
                });
            }

            while (state.isPaused) {
                await new Promise((resolve) => setTimeout(resolve, 250)); // Poll every 100ms
            }

            try {
                const sourceFilePath = path.join(sourceBasePath, video.path);

                const destSubDir = video.path.substr(0, video.path.lastIndexOf('/'));

                const destFilePath = path.join(destinationPath, destSubDir, video.name);

                if (!fsExtra.existsSync(sourceFilePath)) {
                    errorMovingFile.push({
                        videoPath: video.path,
                        error: `source video file not found for  ${sourceFilePath}`,
                    });
                    emitStatus({
                        status: statusMap.IN_PROGRESS,
                        statusMessage: `Error backing up ${video.path}: ${err.message}`,
                        trackingId: exportingTrackingId,
                    });
                    continue;
                }

                // check if destination file path exists
                let finalDestPath = destFilePath;
                let counter = 1;

                // add numbers at then to make the file name unique enough to avoid conflicting name
                while (fsExtra.existsSync(finalDestPath)) {
                    const parsed = path.parse(destFilePath);
                    finalDestPath = path.join(parsed.dir, `${parsed.name}_${counter}${parsed.ext}`);
                    counter++;
                }

                await fsExtra.ensureDir(path.dirname(finalDestPath));

                await fsExtra.copy(sourceFilePath, finalDestPath, {
                    overwrite: false,
                    errorOnExist: false,
                    preserveTimestamps: true,
                });

                state = emitStatus({
                    status: statusMap.IN_PROGRESS,
                    backedupVideos: state.backedupVideos + 1,
                    statusMessage: `Backed up ${state.backedupVideos + 1} of ${state.totalVideos} videos`,
                });
            } catch (err) {
                emitStatus({
                    status: statusMap.IN_PROGRESS,
                    statusMessage: `Error backing up ${video.path}: ${err.message}`,
                    trackingId: exportingTrackingId,
                });
            }
        }

        if (errorMovingFile.length === 0) {
            return emitStatus({
                status: statusMap.SUCCESS,
                statusMessage: `Exporting completed: ${state.backedupVideos} of ${state.totalVideos} videos`,
                trackingId: exportingTrackingId,
            });
        } else {
            return emitStatus({
                status: statusMap.PARTIALLY_SUCCESS,
                statusMessage: `Exporting completed with: ${state.backedupVideos} of ${state.totalVideos} videos.`,
                trackingId: exportingTrackingId,
            });
        }
    } catch (err) {
        return emitStatus({
            status: statusMap.FAILURE,
            statusMessage: `Exporting failed: ${err.message}`,
            trackingId: exportingTrackingId,
        });
    }
};

const pauseExporting = () => {
    if (state.status === statusMap.IN_PROGRESS) {
        state = { ...state };
        emitStatus({
            status: statusMap.PAUSED,
            statusMessage: 'Exporting paused',
            isPaused: true,
        });
    }
};

const resumeExporting = () => {
    if (state.status === statusMap.PAUSED) {
        state = { ...state, isPaused: false };
        emitStatus({
            status: statusMap.IN_PROGRESS,
            statusMessage: 'Exporting resumed',
        });
    }
};

const stopExporting = (trackingId) => {
    state = { ...state, isStopped: true, trackingId: trackingId };
};

const getStatus = () => state;

// progress exporting events
const logExportingProgress = (stats) => {};

// error logging
const logExportingProgressError = (message) => logLibraryError('Video exporting error:', message);

module.exports = {
    startExportingVideos: startExporting,
    pauseExportingVideos: pauseExporting,
    resumeExportingVideos: resumeExporting,
    stopExportingVideos: stopExporting,
    videoExportingStatus: getStatus,
};
