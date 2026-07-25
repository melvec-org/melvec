import React from 'react';
import style from './HorizontalPlaylist.css';
import VideoTile from '../core-components/video-tile/VideoTile';
import { useApplicationContext } from '../../contexts/app.context';

const HorizontalPlaylist = ({ title = '', playlist = [], onPlaylistItemClick = null }) => {
    return (
        <div className={style.horizontalPlaylist}>
            <h3 className={style.playlistTitle}>{title}</h3>
            <div className={style.horizontalPlaylistItemWrapper}>
                {playlist.map((item) => {
                    return (
                        <VideoTile
                            key={item.id}
                            thumbnailURL={item.thumbnailURL}
                            item={item}
                            title={item.name}
                            onClick={() => onPlaylistItemClick(item)}
                        ></VideoTile>
                    );
                })}
            </div>
        </div>
    );
};

export default HorizontalPlaylist;
