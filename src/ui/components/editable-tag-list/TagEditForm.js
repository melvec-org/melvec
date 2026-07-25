import DataInputList from '__components/core-components/data-input-list/DataInputList';
import getUniqueID from '../../../services/service-utils/getUniqueID';
import { useApplicationContext } from '__contexts/app.context';
import EditableTagListStyle from './EditableTagList.css';
import formStyles from '__styles/forms.css';
import React, { useEffect, useState, useRef } from 'react';
import TagChip from './TagChip';
import Button from '../core-components/button/Button';
import getRelativeComplement from '../../utils/getRelativeComplement';
import { MAX_TAGS_PER_MEDIA } from '__configs/appConfig';
import { ModalActionFooter } from '__components/core-components/modal/Modal';

import mediaTypes from '__constants/mediaTypes';
import responseStatus from '__constants/responseStatus';

const TagEditForm = ({ existingTags = [], mediaId, closeTagEditForm, onTagsEditDone, mediaTitle, mediaType = mediaTypes.VIDEO }) => {
    const [stateContext] = useApplicationContext();

    const [usedTags, setUsedTags] = useState(existingTags);
    const [unusedTags, setUnusedTags] = useState([]);

    const [tagValue, setTagValue] = useState('');
    const [isTagSelectedFromExistingTags, setTagSelectedFromExistingTags] = useState(null);
    const [lastUsedTags, setLastUsedTags] = useState([]);
    const [mostUsedTags, setMostUsedTags] = useState([]);

    const inputBoxRef = useRef(null);

    useEffect(() => {
        setUsedTags(existingTags);

        // fetch history of tags created and most used tags
        const unusedTagsList = getRelativeComplement(stateContext.tags, existingTags);
        setUnusedTags(unusedTagsList);

        window.api.getLastUsedTagsList().then((tagsArr) => {
            let tagsHistoryArr = tagsArr;
            tagsHistoryArr = getRelativeComplement(tagsHistoryArr, usedTags);

            tagsHistoryArr = tagsHistoryArr.slice(0, 10);
            setLastUsedTags(tagsHistoryArr);

            window.api.getMostUsedTagsList().then((mostUsedTags) => {
                const mostUsedButNotInUsed = getRelativeComplement(mostUsedTags, usedTags);
                const mostUsedAndNotInHistory = getRelativeComplement(mostUsedButNotInUsed, tagsHistoryArr);
                setMostUsedTags(mostUsedAndNotInHistory);
            });
            if (inputBoxRef.current) {
                inputBoxRef.current.focus();
            }
        });
    }, [mediaId, existingTags]);

    useEffect(() => {
        if (closeTagEditForm === true) {
            onTagEditComplete();
        }
    }, [closeTagEditForm]);

    /**
     * it should check the following validation
     *  the text should not be present in any of the used, existing tags or history, most used tags
     * @param tag
     */
    const onDataInputChange = (tagLabel) => {
        setTagValue(tagLabel);

        // ignore if it present in existing tags
        if (usedTags.find((item) => item.label === tagLabel)) {
            setTagSelectedFromExistingTags(null);
            return;
        }

        // check if the label is present in unusedTags
        const isFromUnusedTags = unusedTags.find((item) => item.label === tagLabel);

        if (isFromUnusedTags) {
            setTagSelectedFromExistingTags(true);
        } else if (tagLabel.length > 2) {
            setTagSelectedFromExistingTags(false);
        } else {
            setTagSelectedFromExistingTags(null);
        }
    };

    const onTagAddSuccess = (tag) => {
        setTagValue('');
        if (inputBoxRef.current) {
            inputBoxRef.current.focus();
        }

        setUsedTags([...usedTags, tag]);
        setUnusedTags(unusedTags.filter((item) => item.label !== tag.label));
        setLastUsedTags(lastUsedTags.filter((item) => item.id !== tag.id));
        setMostUsedTags(mostUsedTags.filter((item) => item.id !== tag.id));
    };

    // when choosen from existing tags
    const onTagAdd = (tagLabel) => {
        tagLabel = tagLabel.trim();
        const tag = unusedTags.find((item) => item.label === tagLabel);
        const isDuplicate = usedTags.find((item) => item.id === tag.id);
        if (isDuplicate === undefined) {
            window.api.addMediaToTag(mediaType, mediaId, tag.id).then((response) => {
                if (response && response.status === responseStatus.SUCCESS) {
                    onTagAddSuccess(tag);
                } else {
                    alert('Failed to add tag to media', response.message);
                }
            });
        }
    };

    const onTagSelectedFromSuggestionList = (tag, type) => {
        if (type == 'lastUsed') {
            const newLastUsedTags = lastUsedTags.filter((item) => item.id != tag.id);
            setLastUsedTags(newLastUsedTags);
        } else if (type === 'mostUsed') {
            const newMostUsedTags = mostUsedTags.filter((item) => item.id != tag.id);
            setMostUsedTags(newMostUsedTags);
        }
        onTagAdd(tag.label);
    };

    const onTagRemoveFromUsed = (tag) => {
        const updatedUsedTags = usedTags.filter((item) => item.id != tag.id);
        setUsedTags(updatedUsedTags);

        setUnusedTags([...unusedTags, tag]);
    };

    const onTagRemove = (tag) => {
        window.api.removeMediaFromTag(mediaType, mediaId, tag.id).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                onTagRemoveFromUsed(tag);
            } else {
                alert('Failed to remove tag from media', response);
            }
        });
    };

    /**
     * This is used when we need to create a new tag and associate that with the video,
     * @param {*} tagLabel
     */
    const onAddANewTag = (tagLabel) => {
        tagLabel = tagLabel.trim();
        const tag = {
            label: tagLabel,
            id: getUniqueID(),
        };

        window.api.addMediaToNewTag(mediaType, mediaId, tag.id, tag.label).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                setUsedTags([...usedTags, tag]);
                setTagValue('');
                if (inputBoxRef.current) {
                    inputBoxRef.current.focus();
                }
            }
        });
    };

    const onTagEditComplete = () => {
        setTagValue('');
        onTagsEditDone(usedTags);
    };

    const onSelectChange = (tagValue) => {
        if (isTagSelectedFromExistingTags === true) {
            onTagAdd(tagValue);
        } else if (isTagSelectedFromExistingTags === false) {
            onAddANewTag(tagValue);
        }
        setTagValue('');
    };

    return (
        <div className={EditableTagListStyle.TagEditForm}>
            <h3>Edit tags</h3>
            <p className={'secondaryInfo'}>{mediaTitle}</p>
            <div className={'mt15'}>
                {usedTags.map((tag) => (
                    <TagChip
                        isHighlighted={true}
                        label={tag.label}
                        key={tag.id}
                        editable={true}
                        onTagRemove={() => onTagRemove(tag)}
                    ></TagChip>
                ))}
            </div>

            <div className={formStyles.formSection}>
                {usedTags.length < MAX_TAGS_PER_MEDIA && (
                    <DataInputList
                        inputList={unusedTags}
                        value={tagValue}
                        onChangeHandler={onDataInputChange}
                        placeholder="Search/Create a tag"
                        onSelectChange={onSelectChange}
                        ref={inputBoxRef}
                    />
                )}

                {isTagSelectedFromExistingTags === true && tagValue != '' && <Button onClick={() => onTagAdd(tagValue)}>Add tag</Button>}
                {isTagSelectedFromExistingTags === false && tagValue != '' && (
                    <Button onClick={() => onAddANewTag(tagValue)}>Create a new tag</Button>
                )}
                {usedTags.length === MAX_TAGS_PER_MEDIA && (
                    <div>You reached maximum number of tags. Please delete few to add a new one.</div>
                )}
            </div>

            <div className={'mt15'}>
                {(lastUsedTags.length > 0 || mostUsedTags > 0) && <div>You may choose</div>}
                <div className={'mt15'}>
                    {lastUsedTags.map((tag) => (
                        <TagChip
                            label={tag.label}
                            key={tag.id}
                            type={'history'}
                            isSelectable={true}
                            onSelection={() => {
                                onTagSelectedFromSuggestionList(tag, 'lastUsed');
                            }}
                        ></TagChip>
                    ))}
                    {mostUsedTags.map((tag) => (
                        <TagChip
                            label={tag.label}
                            key={tag.id}
                            isSelectable={true}
                            onSelection={() => {
                                onTagSelectedFromSuggestionList(tag, 'mostUsed');
                            }}
                        ></TagChip>
                    ))}
                </div>
            </div>
            <ModalActionFooter>
                <Button type="primaryBtn" onClick={() => onTagEditComplete()}>
                    Done
                </Button>
            </ModalActionFooter>
        </div>
    );
};

export default TagEditForm;
