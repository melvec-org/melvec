import responseStatus from '__constants/responseStatus';
import { useState } from 'react';

const resizeOptions = [
    // 16:9
    { label: '16:9 8K', value: 'standard-8k', width: 7680, height: 4320 },
    { label: '16:9 4K', value: 'standard-4k', width: 3840, height: 2160 },
    { label: '16:9 1080p', value: 'standard-1080p', width: 1920, height: 1080 },
    { label: '16:9 720p', value: 'standard-720p', width: 1280, height: 720 },
    // “540p” is commonly treated as 960x540 for 16:9
    { label: '16:9 540p', value: 'standard-540p', width: 960, height: 540 },
    { label: '16:9 360p', value: 'standard-360p', width: 640, height: 360 },
    // “240p” for 16:9 is commonly 426x240
    { label: '16:9 240p', value: 'standard-240p', width: 426, height: 240 },
    // “144p” for 16:9 is commonly 256x144
    { label: '16:9 144p', value: 'standard-144p', width: 256, height: 144 },

    // 21:9 (approx 2.333:1)
    { label: '21:9 8K', value: 'ultrawide-8K', width: 7680, height: 3291 },
    { label: '21:9 4K', value: 'ultrawide-4K', width: 3840, height: 1646 },
    { label: '21:9 1080p', value: 'ultrawide-1080p', width: 2560, height: 1097 },
    { label: '21:9 720p', value: 'ultrawide-720p', width: 1680, height: 720 },
    { label: '21:9 540p', value: 'ultrawide-540p', width: 1260, height: 540 },
    { label: '21:9 360p', value: 'ultrawide-360p', width: 840, height: 360 },

    // 4:3
    { label: '4:3 8K', value: 'traditional-8K', width: 5760, height: 4320 },
    { label: '4:3 4K', value: 'traditional-4K', width: 2880, height: 2160 },
    { label: '4:3 1080p', value: 'traditional-1080p', width: 1440, height: 1080 },
    { label: '4:3 720p', value: 'traditional-720p', width: 960, height: 720 },
    { label: '4:3 540p', value: 'traditional-540p', width: 720, height: 540 },
    { label: '4:3 360p', value: 'traditional-360p', width: 480, height: 360 },
    { label: '4:3 240p', value: 'traditional-240p', width: 320, height: 240 },
    { label: '4:3 144p', value: 'traditional-144p', width: 192, height: 144 },

    // 1:1
    { label: '1:1 8K', value: 'square-8K', width: 4320, height: 4320 },
    { label: '1:1 4K', value: 'square-4K', width: 2160, height: 2160 },
    { label: '1:1 1080p', value: 'square-1080p', width: 1080, height: 1080 },
    { label: '1:1 720p', value: 'square-720p', width: 720, height: 720 },
    { label: '1:1 540p', value: 'square-540p', width: 540, height: 540 },
    { label: '1:1 360p', value: 'square-360p', width: 360, height: 360 },
    { label: '1:1 240p', value: 'square-240p', width: 240, height: 240 },

    // 9:16 (vertical “reels”)
    { label: '9:16 1080p', value: 'reels-1080p', width: 1080, height: 1920 },
    { label: '9:16 720p', value: 'reels-720p', width: 720, height: 1280 },
    { label: '9:16 540p', value: 'reels-540p', width: 540, height: 960 },

    // 4:5 “social”
    { label: '4:5 1350p', value: 'social-1350p', width: 1080, height: 1350 },
];

const videoFormatOptions = [
    { label: 'MP4', value: 'mp4' },
    { label: 'MKV', value: 'mkv' },
    { label: 'MOV', value: 'mov' },
];

const useExtrasAction = () => {
    const [fileToOptimize, setFileToOptimize] = useState('');
    const [fileToFormat, setFileToFormat] = useState('');
    const [fileToResize, setFileToResize] = useState('');
    const [isConversionInProgress, setIsConversionInProgress] = useState(false);
    const [isOptimizationInProgress, setIsOptimizationInProgress] = useState(false);

    const [optimizeValue, setOptimizeValue] = useState(80);

    const [isResizeInProgress, setIsResizeInProgress] = useState(false);
    const [resizeOptionValue, setResizeOptionValue] = useState(resizeOptions[0].value);
    const [formatValue, setFormatValue] = useState(videoFormatOptions[0].value);

    const openVideoFile = async (target) => {
        const path = await window.api.chooseVideoFileFromSystem();
        if (path === null) return;
        if (target === 'changeFormat') {
            setFileToFormat(path);
        } else if (target === 'optimize') {
            setFileToOptimize(path);
        } else if (target === 'resize') {
            setFileToResize(path);
        }
    };

    //=============================== FILE FORMAT CONVERSION =========================
    const startFormatConversion = (path, format) => {
        setIsConversionInProgress(true);
        window.api
            .startVideoFormatConversion({
                videoPath: path,
                format: format,
            })
            .then((response) => {
                setIsConversionInProgress(false);
                if (response.status === responseStatus.SUCCESS) {
                    alert(`Your mp4 video can be found at: ${response?.data?.destinationPath}`);
                    setFileToFormat('');
                } else if (response.status === 'error') {
                    alert(response.message);
                }
            });
    };

    const stopFormatConversion = () => {
        window.api.stopVideoFormatConversion().then((response) => {
            if ((response.status = responseStatus.SUCCESS)) {
                setIsConversionInProgress(false);
            }
        });
    };

    //=============================== FILE OPTIMIZATION =========================
    const startOptimizing = (path, quality) => {
        const config = {
            path: path,
            quality: quality,
        };
        setIsOptimizationInProgress(true);
        window.api.startOptimizingVideo(config).then((response) => {
            setIsOptimizationInProgress(false);
            if (response.status === responseStatus.SUCCESS) {
                alert(`Your optimized video can be found at: ${response?.data?.destinationPath}`);
                setFileToOptimize('');
            }
        });
    };

    const stopOptimizing = () => {
        window.api.stopOptimizingVideo().then((response) => {
            if ((response.status = responseStatus.SUCCESS)) {
                setIsOptimizationInProgress(false);
            }
        });
    };

    //=============================== FILE RESIZE =========================

    const startResizing = () => {
        const selectedSizeOption = resizeOptions.find((option) => option.value === resizeOptionValue);

        const config = {
            path: fileToResize,
            width: selectedSizeOption.width,
            height: selectedSizeOption.height,
        };

        setIsResizeInProgress(true);
        window.api.startResizingVideo(config).then((response) => {
            setIsResizeInProgress(false);
            if (response.status === responseStatus.SUCCESS) {
                alert(`Your resized video can be found at: ${response?.data?.destinationPath}`);
                setFileToResize('');
            }
        });
    };

    const stopResizing = () => {
        window.api.stopResizingVideo().then((response) => {
            if ((response.status = responseStatus.SUCCESS)) {
                setIsResizeInProgress(false);
            }
        });
    };

    return {
        // format change
        fileToFormat,
        openVideoFile,
        startFormatConversion,
        isConversionInProgress,
        stopFormatConversion,
        formatValue,
        setFormatValue,
        videoFormatOptions,

        // optimization
        fileToOptimize,
        startOptimizing,
        optimizeValue,
        setOptimizeValue,
        stopOptimizing,
        isOptimizationInProgress,

        // resize
        fileToResize,
        isResizeInProgress,
        resizeOptionValue,

        startResizing,
        setResizeOptionValue,
        resizeOptions,
        stopResizing,
    };
};

export default useExtrasAction;
