import { HeaderControlBar, HeaderControlBarLeft } from '__components/core-components/header-control-bar/HeaderControlBar';
import React, { useEffect, useState } from 'react';
import formStyles from '__styles/forms.css';
import Button from '__components/core-components/button/Button';
import useExtrasAction from './useExtrasAction';

const Extras = () => {
    const {
        openVideoFile,

        // format change
        fileToFormat,
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
        startResizing,
        setResizeOptionValue,
        resizeOptions,
        stopResizing,
    } = useExtrasAction();
    return (
        <div>
            <div className={formStyles.formSection}>
                <h3>File format conversion</h3>
                <p>Convert video files into another supported format.</p>
                <div className={formStyles.formInputWrapper}>
                    <Button onClick={() => openVideoFile('changeFormat')}>Choose a file</Button>
                    {fileToFormat && (
                        <div className="secondaryInfo mt10">
                            <label className={formStyles.formInputLabel}>File path:</label> {fileToFormat}
                        </div>
                    )}
                </div>
                {fileToFormat && (
                    <>
                        <div className={formStyles.formInputWrapper}>
                            <label className={formStyles.formInputLabel}>Output format:</label>
                            <select value={formatValue} onChange={(e) => setFormatValue(e.target.value)}>
                                {videoFormatOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button
                            disabled={isConversionInProgress}
                            type={'primaryBtn'}
                            onClick={() => startFormatConversion(fileToFormat, formatValue)}
                            processing={isConversionInProgress}
                        >
                            {!isConversionInProgress ? 'Start conversion' : 'Conversion in progress'}
                        </Button>
                    </>
                )}
                {isConversionInProgress && (
                    <Button type={'primaryBtn'} onClick={() => stopFormatConversion()}>
                        Stop
                    </Button>
                )}
            </div>

            <div className={formStyles.formSection}>
                <h3>Optimize the video</h3>
                <p>Optimize the video to save disk space.</p>
                <div className={formStyles.formInputWrapper}>
                    <Button onClick={() => openVideoFile('optimize')}>Choose a file</Button>
                    {fileToOptimize && (
                        <div className="mt10">
                            <div className={formStyles.formInputWrapper}>
                                <label className="secondaryInfo">File path: </label>
                                <div>{fileToOptimize}</div>
                            </div>
                            <div className={formStyles.formInputWrapper}>
                                <label className={formStyles.formInputLabel}>Quality:</label>
                                <input
                                    type="range"
                                    min={'1'}
                                    max={100}
                                    value={optimizeValue}
                                    onChange={(e) => setOptimizeValue(e.target.value)}
                                />
                                <span className={formStyles.rangeValue}>{optimizeValue}%</span>
                            </div>
                        </div>
                    )}
                </div>
                {fileToOptimize && (
                    <Button
                        disabled={isOptimizationInProgress}
                        type="primaryBtn"
                        processing={isOptimizationInProgress}
                        onClick={() => startOptimizing(fileToOptimize, optimizeValue)}
                    >
                        {!isConversionInProgress ? 'Optimize video' : 'Optimization in progress'}
                    </Button>
                )}
                {isOptimizationInProgress && (
                    <Button type="primaryBtn" onClick={() => stopOptimizing()}>
                        Stop
                    </Button>
                )}
            </div>
            <div className={formStyles.formSection}>
                <h3>Resize the video</h3>
                <p>Resize (make smaller) video to save disk space.</p>
                <div className={formStyles.formInputWrapper}>
                    <Button onClick={() => openVideoFile('resize')}>Choose a file</Button>
                    {fileToResize && <p>File to resize: {fileToResize}</p>}
                </div>
                {fileToResize && (
                    <>
                        <div className={formStyles.formInputWrapper}>
                            <label className={formStyles.formInputLabel}>Select desired resolution:</label>
                            <select defaultValue={resizeOptions?.[0]?.value} onChange={(evt) => setResizeOptionValue(evt.target.value)}>
                                {resizeOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={formStyles.formInputWrapper}>
                            <Button
                                disabled={isResizeInProgress}
                                type="primaryBtn"
                                processing={isResizeInProgress}
                                onClick={() => startResizing()}
                            >
                                {!isResizeInProgress ? 'Resize video' : 'Resize in progress'}
                            </Button>
                            {isResizeInProgress && (
                                <Button type="primaryBtn" onClick={() => stopResizing()}>
                                    Stop
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </div>
            <p className="secondaryInfo">
                <strong>Note:</strong> Do one task at a time. And stay on this section till the task is completed.
            </p>
        </div>
    );
};

export default Extras;
