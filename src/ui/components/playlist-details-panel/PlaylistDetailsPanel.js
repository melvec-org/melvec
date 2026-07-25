import React, { useEffect, useState } from 'react';
import style from './PlaylistDetailsPanel.css';
import VideoTile from '../core-components/video-tile/VideoTile';

import { useApplicationContext } from '__contexts/app.context';
import { showGlobalError, showGlobalNotification } from '__contexts/AppNotificationContext';
import contextMenuEvents from '__events/contextMenuEvents';
import ipcChannels from '__constants/ipcChannels';
import Header from '__components/core-components/header/Header';
import responseStatus from '__constants/responseStatus';

const PlaylistDetailsPanel = ({
    title = '',
    playlistId = '',
    playlistItems = [],
    onPlaylistItemClick = null,
    fallbackMessage = '',
    isUserCurrated = false,
    isEditable = false,
}) => {
    const [stateContext] = useApplicationContext();
    const [localItems, setLocalItems] = useState(playlistItems);
    const [draggedItem, setDraggedItem] = useState(null);

    const onKeyDown = (e, item) => {
        if (e.key === 'Enter') {
            onPlaylistItemClick(item);
        }
    };

    const handleDragStart = (e, item) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => e.preventDefault();

    const handleDrop = (e, targetItem) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.id === targetItem.id) return;

        const updated = [...localItems];

        const fromIndex = updated.findIndex((v) => v.id === draggedItem.id);
        const toIndex = updated.findIndex((v) => v.id === targetItem.id);

        // Remove and insert element
        updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, draggedItem);

        setLocalItems(updated);

        if (toIndex !== -1) {
            window.api.reorderVideosInPlaylist(playlistId, draggedItem.id, toIndex).then((response) => {
                if (response.status === responseStatus.SUCCESS) {
                    showGlobalNotification('Video order changed.');
                } else {
                    showGlobalError('Failed to change the order of the video');
                }
            });
        }

        setDraggedItem(null);
    };

    const onContextClick = (event, item) => {
        event.preventDefault();

        window.api.receiveOnce('contextMenuCommand', (command) => {
            switch (command) {
                case contextMenuEvents.REMOVE_FROM_PLAYLIST:
                    window.api.removeVideoFromPlaylist(playlistId, item.id).then((response) => {
                        if (response.status === responseStatus.SUCCESS) {
                            setLocalItems(localItems.filter((v) => v.id !== item.id));
                            showGlobalNotification('Video removed from playlist.');
                        } else {
                            showGlobalError('Failed to remove video from playlist');
                        }
                    });
                    break;
            }
        });
        window.api.send(ipcChannels.CONTEXT_MENU_REQUEST, { source: 'playlistVideoTile', data: item });
    };

    useEffect(() => {
        setLocalItems(playlistItems);
    }, [playlistItems, playlistId]);

    return (
        <div className={style.playlistDetailsPanel}>
            <div className={style.playlistDetailsPanelHeader}>
                <Header type={'panelTitle'}>
                    {title}
                    <span className={'secondaryInfo'}> ({localItems.length})</span>
                </Header>
            </div>
            <div className={style.playlistDetailsListWrapper}>
                {localItems[0] &&
                    localItems.map((item) => {
                        if (!stateContext.hideHiddenCollections || (stateContext.hideHiddenCollections && !item.isHidden)) {
                            return (
                                <div
                                    key={item.id}
                                    draggable={isEditable}
                                    onDragStart={(e) => handleDragStart(e, item)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, item)}
                                    className={`${style.playlistItem} ${isEditable ? style.editable : ''}`}
                                    onContextMenu={(evt) => onContextClick(evt, item)}
                                >
                                    <VideoTile
                                        key={item.id}
                                        thumbnailURL={item.thumbnailURL}
                                        title={item.name}
                                        item={item}
                                        onClick={(e) => {
                                            onPlaylistItemClick(item);
                                        }}
                                        isNsfw={item.isNsfw}
                                        tabIndex={0}
                                        onKeyDown={(e) => onKeyDown(e, item)}
                                    />
                                </div>
                            );
                        }
                        return null;
                    })}
            </div>
            {playlistItems.length == 0 && (
                <div className="center">
                    <div className="textCenter genericMessageBox">
                        <p className="genericMessage">{fallbackMessage || 'No videos in this playlist.'}</p>
                        {isUserCurrated && (
                            <p className="genericMessage">
                                To add videos to this playlist, go to the video library and select the videos you want to add.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlaylistDetailsPanel;
