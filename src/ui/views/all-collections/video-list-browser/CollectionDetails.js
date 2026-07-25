import React, { useState } from 'react';
import VideoDetailsPanel from '../media-details-panels/VideoDetailsPanel';
import style from './CollectionDetails.css';
import Header from '../../../components/core-components/header/Header';
import IconButton from '../../../components/core-components/icon-button/IconButton';
import VideoFilesList from '../../../components/video-files-list/VideoFilesList';
import useCollectionDetailsAction from './useCollectionDetailsAction';
import SortingSelector from '__components/core-components/sorting-selector/SortingSelector';
import {
    HeaderControlBar,
    HeaderControlBarRight,
    HeaderControlBarLeft,
} from '__components/core-components/header-control-bar/HeaderControlBar';
import Button from '__components/core-components/button/Button';
import ResizableSidePanel from '__components/resizable-panel/ResizableSidePanel';
import ImageDetailsPanel from '../media-details-panels/ImageDetailsPanel';
import mediaTypes from '__constants/mediaTypes';
import BulkMediaEditPanel from '../media-details-panels/BulkMediaEditPanel';
import AudioDetailsPanel from '../media-details-panels/AudioDetailsPanel';

const CollectionDetails = ({ selectedCollection = null, selectedVideoId = null }) => {
    const [pressEnterCount, setPressEnterPreview] = useState(0);
    const {
        currentMediaDetails,
        mediaList,
        viewType,
        changeViewType,
        onMediaFileSelection,
        onSortingChange,
        onMediaDelete,
        onCollectionDelete,
        refreshCollectionList,
        onAnyVideoDetailsChange,
        onAnyImageDetailsChange,
        onAnyAudioDetailsChange,
        isRefreshInProgress,
        // bulk mode
        bulkSelectedIds,
        setBulkSelectedIds,
        isBulkMode,
        bulkSelectedItems,
        onBulkDetailsChange,
    } = useCollectionDetailsAction(selectedCollection, selectedVideoId);

    const collectionDetailsClass = !(selectedCollection.isExternal && isRefreshInProgress)
        ? style.collectionDetails
        : `${style.collectionDetails} freezedComponent`;

    return (
        <div className={collectionDetailsClass}>
            <div className={style.videoListWrapper}>
                <div className={style.videoListAppHeader}>
                    <HeaderControlBar variant="small">
                        <HeaderControlBarLeft>
                            <Header type={'panelTitle'}>
                                {selectedCollection.label}
                                <span className={'secondaryInfo'}> ({mediaList.list.length})</span>
                                {selectedCollection.isHidden === 1 && <span className={'badge'}>Hidden</span>}
                            </Header>
                        </HeaderControlBarLeft>

                        <HeaderControlBarRight>
                            {selectedCollection.isExternal && !isRefreshInProgress && (
                                <Button type="transparentBtn" onClick={() => refreshCollectionList()} disabled={isBulkMode}>
                                    Refresh
                                </Button>
                            )}
                            {mediaList.list[0] && (
                                <>
                                    <SortingSelector
                                        options={[
                                            { value: 'fileSizeDesc', label: 'Largest first' },
                                            { value: 'fileSizeAsc', label: 'Smallest first' },
                                            { value: 'A_Z', label: 'File name A-Z' },
                                            { value: 'Z_A', label: 'File name Z-A' },
                                            { value: 'durationDesc', label: 'Longest first' },
                                            { value: 'durationAsc', label: 'Sortest first' },
                                            { value: 'dateAddedDesc', label: 'Newest first' },
                                            { value: 'dateAddedAsc', label: 'Oldest first' },
                                        ]}
                                        placeholder={'Sort by'}
                                        onChange={onSortingChange}
                                        disabled={isBulkMode}
                                    ></SortingSelector>
                                    <div className={`${style.viewOptions}${isBulkMode ? ` ${style.viewOptionsDisabled}` : ''}`}>
                                        <IconButton
                                            icon={'listView'}
                                            isSelected={viewType === 'list'}
                                            onClick={() => !isBulkMode && changeViewType('list')}
                                            disabled={isBulkMode}
                                        />
                                        <IconButton
                                            icon={'gridView'}
                                            isSelected={viewType === 'grid'}
                                            onClick={() => !isBulkMode && changeViewType('grid')}
                                            disabled={isBulkMode}
                                        />
                                    </div>
                                </>
                            )}
                        </HeaderControlBarRight>
                    </HeaderControlBar>
                </div>
                {mediaList.list[0] && (
                    <VideoFilesList
                        list={mediaList.list}
                        listName={mediaList.listName}
                        view={viewType}
                        onListItemEnterPress={(id) => setPressEnterPreview(pressEnterCount + 1)}
                        onListItemClick={(videoDetails) => onMediaFileSelection(videoDetails)}
                        onMediaDelete={(mediaId) => onMediaDelete(null, mediaId)}
                        isExternal={selectedCollection.isExternal}
                        preSelectedItem={currentMediaDetails}
                        onBulkSelectionChange={(ids) => setBulkSelectedIds(ids)}
                    />
                )}

                {!mediaList.list[0] && (
                    <div className="center">
                        {selectedCollection.label !== 'Default collection' && !selectedCollection.isExternal && (
                            <div className="textCenter genericMessageBox">
                                <p className="genericMessage">
                                    This collection does not contain any video. You may import some of the videos or move other videos to
                                    this collection.
                                </p>
                                <div>
                                    <p className="genericMessage">If you wish to delete this collection click the button below. </p>
                                    <div className="mt15">
                                        <Button onClick={() => onCollectionDelete()}>Delete Collection</Button>
                                    </div>
                                    <p>Note: This action cannot be undone.</p>
                                </div>
                            </div>
                        )}
                        {selectedCollection.label === 'Default collection' && (
                            <div className="textCenter genericMessageBox">
                                <div className="textCenter">
                                    <p className="genericMessage">
                                        This a system generated collection.
                                        <br /> You may import some of the videos or move other videos to this collection.
                                    </p>
                                </div>
                            </div>
                        )}
                        {selectedCollection.isExternal && (
                            <div className="textCenter genericMessageBox">
                                <div className="textCenter">
                                    <p className="genericMessage">
                                        There are no videos in this collection.
                                        <br />
                                        You may remove this watch folder by going to settings/general section.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {mediaList.list[0] && currentMediaDetails && (
                <ResizableSidePanel direction="left" maxWidth={650} minWidth={400} initialWidth={400} panelId={'videoDetailsPanel'}>
                    {!isBulkMode && currentMediaDetails.mediaType === mediaTypes.VIDEO && (
                        <VideoDetailsPanel
                            videoDetailsObj={currentMediaDetails}
                            onDetailsChange={onAnyVideoDetailsChange}
                            playPreview={pressEnterCount}
                        />
                    )}
                    {!isBulkMode && currentMediaDetails.mediaType === mediaTypes.IMAGE && (
                        <ImageDetailsPanel imageDetailsObj={currentMediaDetails} onDetailsChange={onAnyImageDetailsChange} />
                    )}
                    {!isBulkMode && currentMediaDetails.mediaType === mediaTypes.AUDIO && (
                        <AudioDetailsPanel audioDetailsObj={currentMediaDetails} onDetailsChange={onAnyAudioDetailsChange} />
                    )}
                    {isBulkMode && (
                        <BulkMediaEditPanel
                            mediaList={bulkSelectedItems}
                            onBulkDetailsChange={onBulkDetailsChange}
                            isExternal={selectedCollection.isExternal}
                        ></BulkMediaEditPanel>
                    )}
                </ResizableSidePanel>
            )}
        </div>
    );
};

export default CollectionDetails;
