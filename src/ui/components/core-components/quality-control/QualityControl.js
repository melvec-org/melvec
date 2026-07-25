import React, { useEffect, useState } from 'react';
import rendererEvents from '../../../../events/rendererEvents';
import style from './QualityControl.css';

/**
 * Quality control component
 * this component make use of a html input range component to show the value of the content quality
 */
const QualityControl = ({ quality = 0, videoId = '' }) => {
    const [contentQuality, setContentQuality] = useState(quality);

    useEffect(() => {
        if (videoId) {
            setContentQuality(quality);
        }
    }, [videoId, quality]);

    const onChange = (event) => {
        //
        // Update the content quality in the local state
        setContentQuality(event.target.value);

        // Update the content quality in the database
        window.api.updateContentQuality(videoId, parseInt(event.target.value));
    };

    return (
        <div className={style.qualityControl}>
            <input
                type="range"
                min="0"
                max="10"
                step={1}
                className={style.slider}
                value={contentQuality}
                onChange={onChange}
                tabIndex={0}
            />
            <span className={style.sliderValue}>{contentQuality}</span>
        </div>
    );
};
export default QualityControl;
