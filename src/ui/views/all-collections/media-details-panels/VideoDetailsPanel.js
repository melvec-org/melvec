import React, { useEffect, useRef, useState } from 'react';
import mediaDetailsStyles from './MediaDetailsPanel.css';
import Button from '__components/core-components/button/Button';
import EditableTagList from '__components/editable-tag-list/EditableTagList';
import EditableCollection from '__components/editable-collection/EditableCollection';
import Video from '__components/core-components/video/Video';
import { useApplicationContext } from '__contexts/app.context';
import EditablePlaylist from '__components/editable-playlist/EditablePlaylist';
import { getReadableFileSizeString } from '__utils/getReadableFileSizeString';
import QualityControl from '__components/core-components/quality-control/QualityControl';
import Rating from '__components/core-components/rating/Rating';
import useVideoDetailsAction from './useVideoDetailsAction';
import EditableTitle from '__components/editable-title/EditableTitle';
import { formatTime } from '__utils/timeUtils';
import EditableFileName from '__components/editable-file-name/EditableFileName';
import VideoSourceSelector from './VideoSourceSelector';
import EditableDescription from '__components/editable-description/EditableDescription';
import formStyles from '__styles/forms.css';
import ipcChannels from '__constants/ipcChannels';
import EditableCategory from '__components/editable-category/EditableCategory';
import { MetaDataRow, MetaDataHeader, MetaDataLabel, MetaDataValue } from '__components/core-components/meta-data/MetaData';
import mediaTypes from '__constants/mediaTypes';
import EditableLocation from '__components/editable-location/EditableLocation';

const VideoDetailsPanel = ({ videoDetailsObj = null, onDetailsChange, playPreview }) => {
    const [stateContext] = useApplicationContext();
    const [videoWidthHeight, setVideoWidthHeight] = useState('');
    const videoRef = useRef(null);

    const containerRef = React.useRef(null);

    const { updatedVideoDetails, moveToCollection, updateTitle, udpateSource, updateNsfwStatus, updateCategory, refreshshVideoDetails } =
        useVideoDetailsAction(videoDetailsObj, onDetailsChange);

    const onVideoMetaDataFound = (metaObj) => {
        setVideoWidthHeight(`${metaObj.videoWidth}x${metaObj.videoHeight}`);

        containerRef.current.scroll({
            top: 0,
            behavior: 'smooth',
        });
    };

    const getVideoPath = (videoDetails) => {
        if (!videoDetailsObj.isExternal) {
            return `${stateContext.userPreferences.libraryPath}/${videoDetails.path}`;
        } else {
            return videoDetailsObj.path;
        }
    };

    const onContextMenuClick = (event, path) => {
        event.preventDefault();
        window.api.send(ipcChannels.CONTEXT_MENU_REQUEST, {
            source: mediaTypes.VIDEO,
            data: {
                path: path,
            },
        });
    };

    useEffect(() => {
        if (playPreview === 0 || !videoRef.current) return;
        const player = videoRef.current;
        if (player.element.paused) {
            player.play();
        } else {
            player.pause();
        }
    }, [playPreview]);

    return (
        <div className={mediaDetailsStyles.mediaDetailsPanel} ref={containerRef}>
            <div
                className={mediaDetailsStyles.miniVideoContainer}
                onContextMenu={(e) => onContextMenuClick(e, getVideoPath(updatedVideoDetails))}
            >
                <Video
                    ref={videoRef}
                    src={getVideoPath(updatedVideoDetails)}
                    videoId={updatedVideoDetails.id}
                    onMetaDataFound={onVideoMetaDataFound}
                    isExternal={videoDetailsObj.isExternal}
                    isNsfw={Boolean(updatedVideoDetails.isNsfw)}
                    hideNsfwContent={Boolean(stateContext.userPreferences.hideNsfwContent)}
                    onLoadError={() =>
                        onDetailsChange({
                            change: 'deleteVideoFromLibrary',
                            data: { mediaId: updatedVideoDetails.id, initiator: 'ENOENT' },
                        })
                    }
                />
            </div>
            {!videoDetailsObj.isExternal ? (
                <MetaDataRow>
                    <EditableFileName
                        mediaId={updatedVideoDetails.id}
                        mediaFileName={updatedVideoDetails.name}
                        onFileNameChange={(mediaId, title) => onDetailsChange({ change: 'fileName', data: { mediaId, fileName: title } })}
                    />
                </MetaDataRow>
            ) : (
                <MetaDataRow>
                    <h3>{updatedVideoDetails.name}</h3>
                </MetaDataRow>
            )}
            {!videoDetailsObj.isExternal && (
                <MetaDataRow>
                    <MetaDataLabel>Title</MetaDataLabel>
                    <MetaDataValue>
                        <EditableTitle mediaTitle={updatedVideoDetails.title} mediaId={updatedVideoDetails.id} onUpdate={updateTitle} />
                    </MetaDataValue>
                </MetaDataRow>
            )}
            <MetaDataRow>
                <MetaDataLabel>File created</MetaDataLabel>
                <MetaDataValue>{new Date(updatedVideoDetails.birthtimeMs).toUTCString()}</MetaDataValue>
            </MetaDataRow>
            <MetaDataRow>
                <MetaDataLabel>File Size</MetaDataLabel>
                <MetaDataValue>{getReadableFileSizeString(updatedVideoDetails.size)}</MetaDataValue>
            </MetaDataRow>
            <MetaDataRow>
                <MetaDataLabel>Duration</MetaDataLabel>
                <MetaDataValue>{formatTime(updatedVideoDetails.duration)}</MetaDataValue>
            </MetaDataRow>

            <MetaDataRow>
                <MetaDataLabel>Video Quality</MetaDataLabel>
                <MetaDataValue>{videoWidthHeight}</MetaDataValue>
            </MetaDataRow>
            {!updatedVideoDetails.isExternal && updatedVideoDetails.locationName !== null && (
                <MetaDataRow>
                    <MetaDataLabel>Location</MetaDataLabel>
                    <MetaDataValue>
                        <EditableLocation
                            mediaId={updatedVideoDetails.id}
                            mediaType={mediaTypes.VIDEO}
                            locationName={updatedVideoDetails.locationName || ''}
                            onEditComplete={refreshshVideoDetails}
                        />
                    </MetaDataValue>
                </MetaDataRow>
            )}
            {!updatedVideoDetails.isExternal && (
                <MetaDataRow>
                    <MetaDataLabel>Views</MetaDataLabel>
                    <MetaDataValue>{updatedVideoDetails.views || 0}</MetaDataValue>
                </MetaDataRow>
            )}
            {!videoDetailsObj.isExternal && (
                <MetaDataRow>
                    <MetaDataLabel>Source</MetaDataLabel>
                    <MetaDataValue>
                        <VideoSourceSelector
                            currentSource={updatedVideoDetails.source}
                            videoId={updatedVideoDetails.id}
                            onSourceChange={udpateSource}
                        />
                    </MetaDataValue>
                </MetaDataRow>
            )}
            {videoDetailsObj.isExternal && !videoDetailsObj.isDuplicate && (
                <MetaDataRow>
                    <MetaDataLabel>Move to a collection</MetaDataLabel>
                    <MetaDataValue>
                        <EditableCollection
                            label={'Select a collection'}
                            selectionList={updatedVideoDetails.allowedCollections}
                            mediaId={updatedVideoDetails.id}
                            isExternal={true}
                            onCollectionChange={moveToCollection}
                        />
                    </MetaDataValue>
                </MetaDataRow>
            )}
            {videoDetailsObj.isExternal && videoDetailsObj.isDuplicate && (
                <MetaDataRow>
                    <MetaDataValue>
                        <strong>⚠ This is a duplicate video. You may delete this.</strong>
                    </MetaDataValue>
                </MetaDataRow>
            )}
            {!videoDetailsObj.isExternal && (
                <MetaDataRow>
                    <MetaDataLabel>NSFW</MetaDataLabel>
                    <MetaDataValue>
                        <div className={formStyles.formSwitch}>
                            <input
                                type="checkbox"
                                id={`video-nsfw-toggle-${updatedVideoDetails.id}`}
                                checked={Boolean(updatedVideoDetails.isNsfw)}
                                onChange={(event) => updateNsfwStatus(updatedVideoDetails.id, event.target.checked)}
                            />
                            <label htmlFor={`video-nsfw-toggle-${updatedVideoDetails.id}`} className={formStyles.formSwitchToggle}></label>
                        </div>
                    </MetaDataValue>
                </MetaDataRow>
            )}
            {!updatedVideoDetails.isExternal && (
                <>
                    <MetaDataRow>
                        <MetaDataLabel>Content Quality</MetaDataLabel>
                        <MetaDataValue>
                            <QualityControl videoId={updatedVideoDetails.id} quality={updatedVideoDetails.quality} />
                        </MetaDataValue>
                    </MetaDataRow>
                    <MetaDataRow>
                        <MetaDataLabel>Rating</MetaDataLabel>
                        <MetaDataValue>
                            <Rating videoId={updatedVideoDetails.id} rating={updatedVideoDetails.rating} />
                        </MetaDataValue>
                    </MetaDataRow>
                    <MetaDataRow>
                        <MetaDataLabel>Collection</MetaDataLabel>
                        <MetaDataValue>
                            <EditableCollection
                                label={updatedVideoDetails.collection}
                                selectionList={updatedVideoDetails.allowedCollections}
                                mediaId={updatedVideoDetails.id}
                                isExternal={false}
                                onCollectionChange={moveToCollection}
                            />
                        </MetaDataValue>
                    </MetaDataRow>
                    <MetaDataRow>
                        <MetaDataLabel>Category</MetaDataLabel>
                        <MetaDataValue>
                            <EditableCategory
                                selectionList={stateContext.videoCategories}
                                videoId={updatedVideoDetails.id}
                                categoryId={updatedVideoDetails.categoryId}
                                onCategoryChange={updateCategory}
                            />
                        </MetaDataValue>
                    </MetaDataRow>
                    <MetaDataHeader>Tags</MetaDataHeader>
                    <MetaDataValue>
                        <EditableTagList
                            mediaId={updatedVideoDetails.id}
                            preselectedTaglists={updatedVideoDetails.tags}
                            mediaTitle={updatedVideoDetails.name}
                            mediaType={mediaTypes.VIDEO}
                            onEditComplete={refreshshVideoDetails}
                        />
                    </MetaDataValue>
                    <MetaDataHeader>Playlists</MetaDataHeader>
                    <MetaDataValue>
                        <EditablePlaylist
                            videoId={videoDetailsObj.id}
                            preselectedPlaylists={updatedVideoDetails.playlists}
                            videoTitle={updatedVideoDetails.name}
                        />
                    </MetaDataValue>
                    <MetaDataHeader>Description</MetaDataHeader>
                    <MetaDataValue>
                        <EditableDescription
                            mediaId={updatedVideoDetails.id}
                            mediaTitle={updatedVideoDetails.name}
                            onEditComplete={refreshshVideoDetails}
                            mediaType={mediaTypes.VIDEO}
                        />
                    </MetaDataValue>
                </>
            )}
            <div className={mediaDetailsStyles.mediaDetailsPanelFooter}>
                <Button
                    onClick={() =>
                        onDetailsChange({
                            change: 'deleteVideoFromLibrary',
                            data: { videoId: updatedVideoDetails.id, initiator: 'user' },
                        })
                    }
                >
                    Delete File
                </Button>
            </div>
        </div>
    );
};

export default VideoDetailsPanel;
