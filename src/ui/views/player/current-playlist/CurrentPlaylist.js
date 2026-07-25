import React, { useEffect } from 'react';
import VideoTile from '../../../components/core-components/video-tile/VideoTile';
import Style from './CurrentPlaylist.css';

import { useApplicationContext } from '__contexts/app.context';
import useListControl from '../../../utils/useListControl';

const CurrentPlaylist = ({ playlist = [], selectedItem = null }) => {
    const [, dispatchContext] = useApplicationContext();
    const { handleKeyUp, focusedListItem, setFocusedListItem, selectionByEnter, setList } = useListControl(selectedItem);

    const onPlaylistItemClick = (item) => {
        selectedItem = item;
        dispatchContext({ type: 'playVideo', payload: item });
    };

    const onThumbnailLoadError = (item) => {};

    useEffect(() => {
        if (playlist.length > 0) {
            setList(playlist);
        }
    }, [playlist]);

    useEffect(() => {
        if (selectedItem) {
            setFocusedListItem(selectedItem);
        }
    }, [selectedItem]);

    useEffect(() => {
        if (selectionByEnter) {
            dispatchContext({ type: 'playVideo', payload: selectionByEnter });
        }
    }, [selectionByEnter]);

    return (
        <div className={Style.currentPlaylist} onKeyUp={handleKeyUp} tabIndex={0}>
            {playlist.map((item) => {
                return (
                    <VideoTile
                        item={item}
                        key={item.id}
                        thumbnailURL={item.thumbnailURL}
                        title={item.name}
                        variant="row"
                        onClick={() => {
                            onPlaylistItemClick(item);
                        }}
                        duration={item.duration || null}
                        selected={selectedItem?.id === item.id}
                        isfocused={focusedListItem?.id === item.id ? 'true' : 'false'}
                        onThumbnailLoadError={() => onThumbnailLoadError(item)}
                    />
                );
            })}
        </div>
    );
};

export default CurrentPlaylist;
