import formStyles from '__styles/forms.css';

import { useApplicationContext } from '__contexts/app.context';
import React, { useEffect, useState } from 'react';
import Button from '__components/core-components/button/Button';
import mediaDetailsStyles from './MediaDetailsPanel.css';
import { MetaDataLabel, MetaDataRow, MetaDataValue } from '__components/core-components/meta-data/MetaData';
import mediaTypes from '__constants/mediaTypes';
import EditableCategory from '__components/editable-category/EditableCategory';
import EditableCollection from '__components/editable-collection/EditableCollection';
import getEligibleCollections from '__utils/getEligibleCollections';
/**
 * Bulk media edit panel should have 3-4 things
 * 1. Delete media button
 * 2. Move to collection dropdown
 * 3. If not isExternal media then change category if all media are in same category
 * 4. NSFW toggle button
 *
 * It should not show any media preview, but list of media names selected.
 *
 * To start with lets have only delete media button.
 * @param {} param0
 */

const BulkMediaEditPanel = ({ mediaList = [], onBulkDetailsChange, isExternal = false }) => {
    const [stateContext] = useApplicationContext();

    const [applicableData, setApplicableData] = useState(null);

    const deleteAllMedia = () => {
        onBulkDetailsChange({
            change: 'delete',
            data: { mediaList: mediaList, initiator: 'user' },
        });
    };

    const updateNsfwStatus = (isNsfw) => {
        onBulkDetailsChange({
            change: 'isNsfw',
            data: { mediaList: mediaList, isNsfw: isNsfw },
        });
    };

    const updateCategory = (categoryId) => {
        onBulkDetailsChange({
            change: 'category',
            data: { mediaList: mediaList, categoryId: categoryId },
        });
    };

    const switchCollection = (changeDetails) => {
        onBulkDetailsChange({
            change: 'switchCollection',
            data: { mediaList: mediaList, newCollection: changeDetails.newCollection },
        });
    };

    const importToCollection = (changeDetails) => {
        onBulkDetailsChange({
            change: 'importToCollection',
            data: { mediaList: mediaList, newCollection: changeDetails.newCollection },
        });
    };

    const resetMetaData = (metaDataList = []) => {
        const defaultMetaData = ['description', 'title', 'category'];
        const metaDataToReset = metaDataList.length > 0 ? metaDataList : defaultMetaData;
        onBulkDetailsChange({
            change: 'resetMetaData',
            data: { mediaList: mediaList, metaDataList: metaDataToReset },
        });
    };

    useEffect(() => {
        if (mediaList.length === 0) {
            return;
        }

        const allNsfw = mediaList.every((item) => item.isNsfw);
        const noneNsfw = mediaList.every((item) => !item.isNsfw);

        const allVideos = mediaList.every((item) => item.mediaType === mediaTypes.VIDEO);

        const allOfSameYear = mediaList.every((item) => item.year === mediaList[0].year);

        let bulkNsfwSelected = false;
        if (allNsfw) {
            bulkNsfwSelected = true;
        } else if (noneNsfw) {
            bulkNsfwSelected = false;
        }

        const collectionIdToExclude = !isExternal ? [mediaList[0].collectionId] : [];
        const applicableCollections = getEligibleCollections(
            mediaList[0].birthtimeMs,
            false,
            stateContext.collections,
            stateContext.hideHiddenCollections,
            collectionIdToExclude,
        );

        setApplicableData({
            applicableCollections: applicableCollections,
            applicableControls: {
                deleteFiles: true,
                // show category selection only for library media (not watch folder)
                changeCategory: !isExternal && allVideos,
                // show collection move for library items
                switchCollection: !isExternal,
                // this one for watch folder media where all items are not duplicates and all belong to single year.
                importToCollection: isExternal && !mediaList.find((item) => item.isDuplicate) && allOfSameYear,
                // show NSFW toggle only for library media where all items share the same status
                // (mixed selection is ambiguous — toggling would be unclear)
                nsfwToggle: !isExternal && (allNsfw || noneNsfw),

                resetMetaData: !isExternal,
            },
            bulkNsfwSelected: bulkNsfwSelected,
        });
    }, [mediaList]);
    if (applicableData) {
        return (
            <div className={mediaDetailsStyles.mediaDetailsPanel}>
                <div>
                    <h3>
                        {mediaList.length} item{mediaList.length !== 1 ? 's' : ''} selected
                    </h3>
                </div>

                <ul className={mediaDetailsStyles.bulkFileNameList}>
                    {mediaList.map((item) => (
                        <li key={item.id} className={mediaDetailsStyles.bulkFileNameItem} title={item.name}>
                            {item.name}
                        </li>
                    ))}
                </ul>
                {applicableData.applicableControls.changeCategory && (
                    <MetaDataRow>
                        <MetaDataLabel>Category</MetaDataLabel>
                        <MetaDataValue>
                            <EditableCategory
                                selectionList={stateContext.videoCategories}
                                categoryId={stateContext.videoCategories[0].id}
                                onCategoryChange={updateCategory}
                            />
                        </MetaDataValue>
                    </MetaDataRow>
                )}
                {applicableData.applicableControls.nsfwToggle && (
                    <MetaDataRow>
                        <MetaDataLabel>NSFW</MetaDataLabel>
                        <MetaDataValue>
                            <div className={formStyles.formSwitch}>
                                <input
                                    type="checkbox"
                                    id={`image-nsfw-toggle-all`}
                                    checked={applicableData.bulkNsfwSelected}
                                    onChange={(event) => updateNsfwStatus(event.target.checked)}
                                />
                                <label htmlFor={`image-nsfw-toggle-all`} className={formStyles.formSwitchToggle}></label>
                            </div>
                        </MetaDataValue>
                    </MetaDataRow>
                )}
                {applicableData.applicableControls.switchCollection && (
                    <div>
                        <MetaDataRow>
                            <MetaDataLabel>Change collection</MetaDataLabel>
                            <MetaDataValue>
                                <EditableCollection
                                    label={'Select a collection'}
                                    selectionList={applicableData.applicableCollections}
                                    categoryId={stateContext.videoCategories[0].id}
                                    mediaId={''}
                                    isExternal={false}
                                    onCollectionChange={switchCollection}
                                />
                            </MetaDataValue>
                        </MetaDataRow>
                    </div>
                )}
                {applicableData.applicableControls.importToCollection && (
                    <div>
                        <MetaDataRow>
                            <MetaDataLabel>Import to a collection</MetaDataLabel>
                            <MetaDataValue>
                                <EditableCollection
                                    label={'Select a collection'}
                                    selectionList={applicableData.applicableCollections}
                                    categoryId={stateContext.videoCategories[0].id}
                                    isExternal={true}
                                    onCollectionChange={importToCollection}
                                />
                            </MetaDataValue>
                        </MetaDataRow>
                    </div>
                )}

                {applicableData.applicableControls.deleteFiles && (
                    <div className={mediaDetailsStyles.mediaDetailsPanelFooter}>
                        {applicableData.applicableControls.resetMetaData && <Button onClick={resetMetaData}>Reset Metadata</Button>}
                        <Button onClick={deleteAllMedia}>Delete All Files</Button>
                    </div>
                )}
            </div>
        );
    } else {
        return null;
    }
};

export default BulkMediaEditPanel;
