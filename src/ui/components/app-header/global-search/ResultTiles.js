import React from 'react';
import style from './GlobalSearch.css';
import VideoTile from '__components/core-components/video-tile/VideoTile';
const ResultTiles = ({ resultList, onSearchResultItemClick }) => {
    return (
        <ul className={style.searchResultsList}>
            {resultList.map((item) => {
                return (
                    <li className={style.searchResultsListItem} key={item.id}>
                        <VideoTile
                            item={item}
                            thumbnailURL={item.thumbnailURL}
                            title={item.name}
                            variant="row"
                            mediaType={item.mediaType}
                            onClick={() => {
                                onSearchResultItemClick(item);
                            }}
                        />
                    </li>
                );
            })}
        </ul>
    );
};

export default ResultTiles;
