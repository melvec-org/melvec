const path = require('path');
const { runFfmpegWithProgress } = require('../service-utils/process');
const allowedSourceFormat = ['mp4', 'mkv', 'avi', 'mov'];
const allowedDestinationFormat = ['mp4'];
const { getVideoDuration } = require('../service-utils/getVideoDuration');

const activeConversions = new Map(); // processId -> ChildProcess

const convertFormat = async (videoSourcePath, format = 'mp4', destinationDir = '') => {
    const processId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    if (!videoSourcePath || typeof videoSourcePath !== 'string' || videoSourcePath.trim() === '') {
        return Promise.reject(new Error('videoSourcePath must be a non-empty string.'));
    }

    if (!format || typeof format !== 'string' || format.trim() === '') {
        return Promise.reject(new Error('format must be a non-empty string.'));
    }

    // Check if the source video format is supported (use SOURCE path, not destination)
    const sourceVideoFormat = videoSourcePath.split('.').pop()?.toLowerCase();
    if (!sourceVideoFormat || !allowedSourceFormat.includes(sourceVideoFormat)) {
        return Promise.reject(new Error('Unsupported source video format.'));
    }

    if (!allowedDestinationFormat.includes(format)) {
        return Promise.reject(new Error('Unsupported destination video format.'));
    }

    let destinationPath = '';
    if (destinationDir === '') {
        const ext = `.${sourceVideoFormat}`;
        const basePath = videoSourcePath.toLowerCase().endsWith(ext) ? videoSourcePath.slice(0, -ext.length) : videoSourcePath;
        destinationPath = `${basePath}.${format.toLowerCase()}`;
    }

    const totalDurationSec = Number(await getVideoDuration(videoSourcePath)) || 0;

    const args = [
        '-y',
        '-i',
        videoSourcePath,
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        '-f',
        format,
        '-progress',
        'pipe:1',
        '-nostats',
        destinationPath,
    ];
    try {
        await runFfmpegWithProgress(
            args,
            (p) => {
                const outTimeSec = Number(p?.outTimeMs || 0) / 1000 || 0;
                const percent = totalDurationSec > 0 ? Math.max(0, Math.min(100, Math.floor((outTimeSec / totalDurationSec) * 100))) : 0;

                if (typeof onProgress === 'function') {
                    onProgress({
                        ...p,
                        percent,
                        totalDurationSec,
                        destinationPath,
                        processId,
                    });
                }
            },
            (child) => {
                activeConversions.set(processId, child);

                child.on('close', () => {
                    activeConversions.delete(processId);
                });
            },
        );

        return { processId, destinationPath };
    } catch (e) {
    } finally {
        activeConversions.delete(processId);
    }
};

// process id would the videoPath
const stopConversion = async (processId) => {
    if (processId === undefined) {
        // get the first active conversion
        const firstConversion = activeConversions.keys().next().value;

        if (firstConversion) {
            processId = firstConversion;
        }
    }

    const child = activeConversions.get(processId);
    if (!child) {
        return Promise.reject(new Error('No active conversion found for the provided processId.'));
    }
    try {
        child.kill('SIGTERM');
        return true;
    } catch (err) {
        return { status: 'error', message: 'Failed to stop conversion', error: err };
    }
};

module.exports = {
    convertFormat,
    stopConversion,
};
