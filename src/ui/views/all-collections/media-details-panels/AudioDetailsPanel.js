import React, { useEffect, useRef, useState } from 'react';
import ipcChannels from '__constants/ipcChannels';
import mediaTypes from '__constants/mediaTypes';
import EditableTitle from '__components/editable-title/EditableTitle';
import EditableFileName from '__components/editable-file-name/EditableFileName';
import EditableCollection from '__components/editable-collection/EditableCollection';
import Button from '__components/core-components/button/Button';
import { MetaDataRow, MetaDataLabel, MetaDataValue, MetaDataHeader } from '__components/core-components/meta-data/MetaData';
import { getReadableFileSizeString } from '__utils/getReadableFileSizeString';
import { useApplicationContext } from '__contexts/app.context';
import formStyles from '__styles/forms.css';
import mediaDetailsStyles from './MediaDetailsPanel.css';

import useAudioDetailsAction from './useAudioDetailsAction';
import EditableTagList from '__components/editable-tag-list/EditableTagList';
import EditableDescription from '__components/editable-description/EditableDescription';
import AudioPlayer from '__components/core-components/audio-player/AudioPlayer';

const AudioDetailsPanel = ({ audioDetailsObj = null, onDetailsChange }) => {
    const [stateContext] = useApplicationContext();
    const containerRef = useRef(null);
    const audioRef = useRef(null);

    const { updatedAudioDetails, updateTitle, updateNsfwStatus, moveToCollection, refreshshAudioDetails } = useAudioDetailsAction(
        audioDetailsObj,
        onDetailsChange,
    );

    const getAudioPath = (audioDetails) => {
        if (!audioDetails?.isExternal) {
            return `${stateContext.userPreferences.libraryPath}/${audioDetails.path}`;
        }

        return audioDetails.path;
    };

    const onAudioLoad = (event) => {
        if (containerRef.current) {
            containerRef.current.scroll({
                top: 0,
                behavior: 'smooth',
            });
        }
    };

    if (!audioDetailsObj) {
        return null;
    }
    const audioPath = getAudioPath(audioDetailsObj);

    return (
        <div className={mediaDetailsStyles.mediaDetailsPanel} ref={containerRef}>
            <AudioPlayer
                ref={audioRef}
                src={audioPath}
                isNsfw={Boolean(updatedAudioDetails.isNsfw)}
                hideNsfwContent={Boolean(stateContext?.userPreferences?.hideNsfwContent)}
                onLoad={onAudioLoad}
                onLoadError={() =>
                    onDetailsChange({
                        change: 'deleteAudioFromLibrary',
                        data: { mediaId: updatedAudioDetails.id, initiator: 'ENOENT' },
                    })
                }
            ></AudioPlayer>

            {!updatedAudioDetails.isExternal ? (
                <MetaDataRow>
                    <EditableFileName
                        mediaId={updatedAudioDetails.id}
                        mediaFileName={updatedAudioDetails.name}
                        mediaType={mediaTypes.AUDIO}
                        onFileNameChange={(mediaId, title) =>
                            onDetailsChange({ change: 'fileName', data: { mediaId: mediaId, fileName: title } })
                        }
                    />
                </MetaDataRow>
            ) : (
                <MetaDataRow>
                    <h3>{updatedAudioDetails.name}</h3>
                </MetaDataRow>
            )}

            {typeof updatedAudioDetails.title !== 'undefined' && !updatedAudioDetails.isExternal && (
                <MetaDataRow>
                    <MetaDataLabel>Title</MetaDataLabel>
                    <MetaDataValue>
                        <EditableTitle mediaTitle={updatedAudioDetails.title} mediaId={updatedAudioDetails.id} onUpdate={updateTitle} />
                    </MetaDataValue>
                </MetaDataRow>
            )}

            <MetaDataRow>
                <MetaDataLabel>File created</MetaDataLabel>
                <MetaDataValue>{new Date(updatedAudioDetails.birthtimeMs).toUTCString()}</MetaDataValue>
            </MetaDataRow>

            <MetaDataRow>
                <MetaDataLabel>File Size</MetaDataLabel>
                <MetaDataValue>{getReadableFileSizeString(updatedAudioDetails.size)}</MetaDataValue>
            </MetaDataRow>

            {updatedAudioDetails.isExternal &&
                !updatedAudioDetails.isDuplicate &&
                Array.isArray(updatedAudioDetails.allowedCollections) && (
                    <MetaDataRow>
                        <MetaDataLabel>Move to a collection</MetaDataLabel>
                        <MetaDataValue>
                            <EditableCollection
                                label={'Select a collection'}
                                selectionList={updatedAudioDetails.allowedCollections}
                                mediaId={updatedAudioDetails.id}
                                isExternal={true}
                                onCollectionChange={moveToCollection}
                            />
                        </MetaDataValue>
                    </MetaDataRow>
                )}

            {updatedAudioDetails.isExternal && updatedAudioDetails.isDuplicate && (
                <MetaDataRow>
                    <MetaDataValue>
                        <strong>⚠ This is a duplicate audio. You may delete this.</strong>
                    </MetaDataValue>
                </MetaDataRow>
            )}

            {!updatedAudioDetails.isExternal && Array.isArray(updatedAudioDetails.allowedCollections) && (
                <MetaDataRow>
                    <MetaDataLabel>Collection</MetaDataLabel>
                    <MetaDataValue>
                        <EditableCollection
                            label={updatedAudioDetails.collection}
                            selectionList={updatedAudioDetails.allowedCollections}
                            mediaId={updatedAudioDetails.id}
                            isExternal={false}
                            onCollectionChange={moveToCollection}
                        />
                    </MetaDataValue>
                </MetaDataRow>
            )}

            {!updatedAudioDetails.isExternal && (
                <>
                    <MetaDataRow>
                        <MetaDataLabel>NSFW</MetaDataLabel>
                        <MetaDataValue>
                            <div className={formStyles.formSwitch}>
                                <input
                                    type="checkbox"
                                    id={`audio-nsfw-toggle-${updatedAudioDetails.id}`}
                                    checked={Boolean(updatedAudioDetails.isNsfw)}
                                    onChange={(event) => updateNsfwStatus(updatedAudioDetails.id, event.target.checked)}
                                />
                                <label
                                    htmlFor={`audio-nsfw-toggle-${updatedAudioDetails.id}`}
                                    className={formStyles.formSwitchToggle}
                                ></label>
                            </div>
                        </MetaDataValue>
                    </MetaDataRow>
                    <MetaDataHeader>Tags</MetaDataHeader>

                    <MetaDataValue>
                        <EditableTagList
                            mediaId={updatedAudioDetails.id}
                            preselectedTaglists={updatedAudioDetails.tags}
                            mediaTitle={updatedAudioDetails.name}
                            mediaType={mediaTypes.AUDIO}
                            onEditComplete={refreshshAudioDetails}
                        />
                    </MetaDataValue>
                    <MetaDataHeader>Description</MetaDataHeader>
                    <MetaDataValue>
                        <EditableDescription
                            mediaId={updatedAudioDetails.id}
                            mediaTitle={updatedAudioDetails.name}
                            onEditComplete={refreshshAudioDetails}
                            shortDesc={updatedAudioDetails.shortDesc}
                            mediaType={mediaTypes.AUDIO}
                        />
                    </MetaDataValue>
                </>
            )}

            <div className={mediaDetailsStyles.mediaDetailsPanelFooter}>
                <Button
                    onClick={() =>
                        onDetailsChange({
                            change: 'deleteAudioFromLibrary',
                            data: { mediaId: updatedAudioDetails.id, initiator: 'user' },
                        })
                    }
                >
                    Delete File
                </Button>
            </div>
        </div>
    );
};

export default AudioDetailsPanel;
