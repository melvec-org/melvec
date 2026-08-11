import React, { useEffect, useRef, useState } from 'react';
import ipcChannels from '__constants/ipcChannels';
import mediaTypes from '__constants/mediaTypes';
import EditableTitle from '__components/editable-title/EditableTitle';
import EditableFileName from '__components/editable-file-name/EditableFileName';
import EditableCollection from '__components/editable-collection/EditableCollection';
import Button from '__components/core-components/button/Button';
import ImagePreview from '__components/core-components/image-preview/ImagePreview';
import { MetaDataRow, MetaDataLabel, MetaDataValue, MetaDataHeader } from '__components/core-components/meta-data/MetaData';
import { getReadableFileSizeString } from '__utils/getReadableFileSizeString';
import { useApplicationContext } from '__contexts/app.context';
import formStyles from '__styles/forms.css';
import mediaDetailsStyles from './MediaDetailsPanel.css';

import useImageDetailsAction from './useImageDetailsAction';
import EditableTagList from '__components/editable-tag-list/EditableTagList';
import EditableDescription from '__components/editable-description/EditableDescription';
import EditableLocation from '__components/editable-location/EditableLocation';

const ImageDetailsPanel = ({ imageDetailsObj = null, onDetailsChange }) => {
    const [stateContext] = useApplicationContext();
    const [imageDimensions, setImageDimensions] = useState('');
    const containerRef = useRef(null);
    const imageRef = useRef(null);

    const { updatedImageDetails, updateTitle, updateNsfwStatus, moveToCollection, refreshshImageDetails } = useImageDetailsAction(
        imageDetailsObj,
        onDetailsChange,
    );

    const getImagePath = (imageDetails) => {
        if (!imageDetails?.isExternal) {
            return `${stateContext.userPreferences.libraryPath}/${imageDetails.path}`;
        }

        return imageDetails.path;
    };

    const onContextMenuClick = (event, imagePath) => {
        event.preventDefault();
        window.api.send(ipcChannels.CONTEXT_MENU_REQUEST, {
            source: 'image',
            data: {
                path: imagePath,
            },
        });
    };

    const onImageLoad = (event) => {
        const width = event.target.naturalWidth;
        const height = event.target.naturalHeight;

        if (width && height) {
            setImageDimensions(`${width}x${height}`);
        }

        if (containerRef.current) {
            containerRef.current.scroll({
                top: 0,
                behavior: 'smooth',
            });
        }
    };

    if (!imageDetailsObj) {
        return null;
    }

    return (
        <div className={mediaDetailsStyles.mediaDetailsPanel} ref={containerRef}>
            <ImagePreview
                ref={imageRef}
                src={getImagePath(updatedImageDetails)}
                alt={updatedImageDetails.title || updatedImageDetails.name || 'Image preview'}
                onContextMenu={(e) => onContextMenuClick(e, imagePath)}
                onLoad={onImageLoad}
                isNsfw={Boolean(updatedImageDetails.isNsfw)}
                hideNsfwContent={Boolean(stateContext?.userPreferences?.hideNsfwContent)}
                onLoadError={() =>
                    onDetailsChange({
                        change: 'deleteImageFromLibrary',
                        data: { mediaId: updatedImageDetails.id, initiator: 'ENOENT' },
                    })
                }
            />

            {!updatedImageDetails.isExternal ? (
                <MetaDataRow>
                    <EditableFileName
                        mediaId={updatedImageDetails.id}
                        mediaFileName={updatedImageDetails.name}
                        mediaType={mediaTypes.IMAGE}
                        onFileNameChange={(mediaId, title) =>
                            onDetailsChange({ change: 'fileName', data: { mediaId: mediaId, fileName: title } })
                        }
                    />
                </MetaDataRow>
            ) : (
                <MetaDataRow>
                    <h3>{updatedImageDetails.name}</h3>
                </MetaDataRow>
            )}

            {typeof updatedImageDetails.title !== 'undefined' && !updatedImageDetails.isExternal && (
                <MetaDataRow>
                    <MetaDataLabel>Title</MetaDataLabel>
                    <MetaDataValue>
                        <EditableTitle mediaTitle={updatedImageDetails.title} mediaId={updatedImageDetails.id} onUpdate={updateTitle} />
                    </MetaDataValue>
                </MetaDataRow>
            )}

            <MetaDataRow>
                <MetaDataLabel>File created</MetaDataLabel>
                <MetaDataValue>{new Date(updatedImageDetails.birthtimeMs).toUTCString()}</MetaDataValue>
            </MetaDataRow>

            <MetaDataRow>
                <MetaDataLabel>File Size</MetaDataLabel>
                <MetaDataValue>{getReadableFileSizeString(updatedImageDetails.size)}</MetaDataValue>
            </MetaDataRow>

            <MetaDataRow>
                <MetaDataLabel>Dimensions</MetaDataLabel>
                <MetaDataValue>{imageDimensions || '-'}</MetaDataValue>
            </MetaDataRow>

            {!updatedImageDetails.isExternal && updatedImageDetails.locationName !== null && (
                <MetaDataRow>
                    <MetaDataLabel>Location</MetaDataLabel>
                    <MetaDataValue>
                        <EditableLocation
                            mediaId={updatedImageDetails.id}
                            mediaType={mediaTypes.IMAGE}
                            locationName={updatedImageDetails.locationName || ''}
                            onEditComplete={refreshshImageDetails}
                        />
                    </MetaDataValue>
                </MetaDataRow>
            )}

            {updatedImageDetails.isExternal &&
                !updatedImageDetails.isDuplicate &&
                Array.isArray(updatedImageDetails.allowedCollections) && (
                    <MetaDataRow>
                        <MetaDataLabel>Move to a collection</MetaDataLabel>
                        <MetaDataValue>
                            <EditableCollection
                                label={'Select a collection'}
                                selectionList={updatedImageDetails.allowedCollections}
                                mediaId={updatedImageDetails.id}
                                isExternal={true}
                                onCollectionChange={moveToCollection}
                            />
                        </MetaDataValue>
                    </MetaDataRow>
                )}

            {updatedImageDetails.isExternal && updatedImageDetails.isDuplicate && (
                <MetaDataRow>
                    <MetaDataValue>
                        <strong>⚠ This is a duplicate image. You may delete this.</strong>
                    </MetaDataValue>
                </MetaDataRow>
            )}

            {!updatedImageDetails.isExternal && Array.isArray(updatedImageDetails.allowedCollections) && (
                <MetaDataRow>
                    <MetaDataLabel>Collection</MetaDataLabel>
                    <MetaDataValue>
                        <EditableCollection
                            label={updatedImageDetails.collection}
                            selectionList={updatedImageDetails.allowedCollections}
                            mediaId={updatedImageDetails.id}
                            isExternal={false}
                            onCollectionChange={moveToCollection}
                        />
                    </MetaDataValue>
                </MetaDataRow>
            )}

            {!updatedImageDetails.isExternal && (
                <>
                    <MetaDataRow>
                        <MetaDataLabel>NSFW</MetaDataLabel>
                        <MetaDataValue>
                            <div className={formStyles.formSwitch}>
                                <input
                                    type="checkbox"
                                    id={`image-nsfw-toggle-${updatedImageDetails.id}`}
                                    checked={Boolean(updatedImageDetails.isNsfw)}
                                    onChange={(event) => updateNsfwStatus(updatedImageDetails.id, event.target.checked)}
                                />
                                <label
                                    htmlFor={`image-nsfw-toggle-${updatedImageDetails.id}`}
                                    className={formStyles.formSwitchToggle}
                                ></label>
                            </div>
                        </MetaDataValue>
                    </MetaDataRow>
                    <MetaDataHeader>Tags</MetaDataHeader>

                    <MetaDataValue>
                        <EditableTagList
                            mediaId={updatedImageDetails.id}
                            preselectedTaglists={updatedImageDetails.tags}
                            mediaTitle={updatedImageDetails.name}
                            mediaType={mediaTypes.IMAGE}
                            onEditComplete={refreshshImageDetails}
                        />
                    </MetaDataValue>
                    <MetaDataHeader>Description</MetaDataHeader>
                    <MetaDataValue>
                        <EditableDescription
                            mediaId={updatedImageDetails.id}
                            mediaTitle={updatedImageDetails.name}
                            onEditComplete={refreshshImageDetails}
                            shortDesc={updatedImageDetails.shortDesc}
                            mediaType={mediaTypes.IMAGE}
                        />
                    </MetaDataValue>
                </>
            )}

            <div className={mediaDetailsStyles.mediaDetailsPanelFooter}>
                <Button
                    onClick={() =>
                        onDetailsChange({
                            change: 'deleteImageFromLibrary',
                            data: { mediaId: updatedImageDetails.id, initiator: 'user' },
                        })
                    }
                >
                    Delete File
                </Button>
            </div>
        </div>
    );
};

export default ImageDetailsPanel;
