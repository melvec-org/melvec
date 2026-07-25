import React from 'react';
import style from './VideoTile.css';
import utilsCSS from '__styles/utils.css';
import Thumbnail from '../thumbnail/Thumbnail';
import onMissingThumbnailFound from '../../../utils/thumbnailCreationService';
import { useApplicationContext } from '__contexts/app.context';
import { formatTime } from '../../../utils/timeUtils';

const VideoTile = ({
    thumbnailURL = '',
    item = null,
    title = '',
    variant = 'tile',
    onClick,
    onKeyDown,
    tabIndex,
    isfocused = 'false',
    selected = false,
    duration = null,
}) => {
    const [stateContext] = useApplicationContext();

    const onThumbnailLoadError = () => {
        onMissingThumbnailFound(
            item.id,
            item.isExternal ? `${item.path}` : `${stateContext.userPreferences.libraryPath}/${item.path}`,
            item.isExternal ? true : false,
        );
    };
    const getClassName = () => {
        let classnames = variant === 'tile' ? style.videoTile : style.videoRow;

        if (selected) classnames += ' ' + style.selected;
        return classnames;
    };

    return (
        <div className={getClassName()} onClick={onClick} tabIndex={tabIndex} onKeyDown={onKeyDown} isfocused={isfocused}>
            <Thumbnail
                url={thumbnailURL}
                variant={variant !== 'tile' ? 'small' : 'large'}
                onError={onThumbnailLoadError}
                isNsfw={item.isNsfw}
                hideNsfwContent={Boolean(stateContext?.userPreferences?.hideNsfwContent)}
                previewPath={item?.previewPath}
                showVideoPreviewOnHover={Boolean(stateContext?.userPreferences?.showVideoPreviewOnHover)}
            />
            <div className={style.descContainer}>
                <div className={style.videoTileTitle}>{title}</div>
                {duration > 0 && <div className={style.metaDataContainer}>{formatTime(duration)}</div>}
            </div>
        </div>
    );
};

export default VideoTile;
